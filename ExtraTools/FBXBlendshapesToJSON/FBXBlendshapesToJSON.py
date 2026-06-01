import sys
import json
from pathlib import Path

import fbx


def getSceneFps(scene: fbx.FbxScene) -> float:
    timeMode = scene.GetGlobalSettings().GetTimeMode()
    fps = fbx.FbxTime.GetFrameRate(timeMode)
    if fps <= 0:
        return 60.0
    return float(fps)


def getAnimStacks(scene: fbx.FbxScene):
    criteria = fbx.FbxCriteria.ObjectType(fbx.FbxAnimStack.ClassId)
    count = scene.GetSrcObjectCount(criteria)
    result = []
    for i in range(count):
        stack = scene.GetSrcObject(criteria, i)
        if stack:
            result.append(stack)
    return result


def getAnimLayers(stack: fbx.FbxAnimStack):
    criteria = fbx.FbxCriteria.ObjectType(fbx.FbxAnimLayer.ClassId)
    count = stack.GetMemberCount(criteria)
    result = []
    for i in range(count):
        layer = stack.GetMember(criteria, i)
        if layer:
            result.append(layer)
    return result


def iterNodes(rootNode: fbx.FbxNode):
    stack = [rootNode]
    while stack:
        node = stack.pop()
        if not node:
            continue
        yield node
        for i in range(node.GetChildCount() - 1, -1, -1):
            stack.append(node.GetChild(i))


def getAnimatedUserCurves(node: fbx.FbxNode, animLayer: fbx.FbxAnimLayer):
    curves = {}

    prop = node.GetFirstProperty()
    while prop.IsValid():
        propName = prop.GetName()

        # Skip built-in transform channels
        if str(propName) not in {"Lcl Translation", "Lcl Rotation", "Lcl Scaling", "Visibility"}:
            curveNode = prop.GetCurveNode(animLayer)
            if curveNode:
                curve = prop.GetCurve(animLayer)
                if curve and curve.KeyGetCount() > 0:
                    keys = []
                    for keyIndex in range(curve.KeyGetCount()):
                        keyTime = curve.KeyGetTime(keyIndex)
                        keyValue = curve.KeyGetValue(keyIndex)
                        keys.append([float(keyTime.GetSecondDouble()), float(keyValue)])
                    curves[str(propName)] = keys

        prop = node.GetNextProperty(prop)

    return curves


def fbxCustomPropsToJson(
    fbxPath: str,
    outPath: str,
    animStackName: str | None = None,
    normalizeStartTime: bool = True,
    includeNodePrefix: bool = False,
):
    manager = fbx.FbxManager.Create()
    if manager is None:
        raise RuntimeError("Failed to create FBX manager")

    ios = fbx.FbxIOSettings.Create(manager, fbx.IOSROOT)
    manager.SetIOSettings(ios)

    importer = fbx.FbxImporter.Create(manager, "")
    if not importer.Initialize(fbxPath, -1, manager.GetIOSettings()):
        raise RuntimeError(f"Failed to load FBX: {fbxPath}")

    scene = fbx.FbxScene.Create(manager, "scene")
    importer.Import(scene)
    importer.Destroy()

    sceneFps = getSceneFps(scene)

    stacks = getAnimStacks(scene)
    if not stacks:
        raise RuntimeError("No animation stacks found in FBX")

    chosenStack = None
    if animStackName:
        for stack in stacks:
            if stack.GetName() == animStackName:
                chosenStack = stack
                break
        if chosenStack is None:
            raise ValueError(f"Animation stack not found: {animStackName}")
    else:
        chosenStack = stacks[0]

    scene.SetCurrentAnimationStack(chosenStack)

    layers = getAnimLayers(chosenStack)
    if not layers:
        raise RuntimeError("Chosen animation stack has no animation layers")

    print(f"Found {len(stacks)} anim stack(s)")
    print(f"Using stack: {chosenStack.GetName()}")
    print(f"Found {len(layers)} anim layer(s) in stack")

    allCurves = {}
    allTimes = []

    rootNode = scene.GetRootNode()
    nodeCount = 0

    for node in iterNodes(rootNode):
        nodeCount += 1

        mergedForNode = {}
        for layer in layers:
            nodeCurves = getAnimatedUserCurves(node, layer)
            for curveName, keys in nodeCurves.items():
                mergedForNode.setdefault(curveName, []).extend(keys)

        for curveName, keys in mergedForNode.items():
            keys.sort(key=lambda x: x[0])

            deduped = []
            lastTime = None
            for t, v in keys:
                if lastTime is not None and abs(t - lastTime) < 1e-8:
                    deduped[-1] = [float(t), float(v)]
                else:
                    deduped.append([float(t), float(v)])
                    lastTime = t

            finalName = f"{node.GetName()}.{curveName}" if includeNodePrefix else curveName
            allCurves[finalName] = deduped
            allTimes.extend(t for t, _ in deduped)

    print(f"Visited {nodeCount} node(s)")
    print(f"Found {len(allCurves)} animated custom curve(s)")

    if normalizeStartTime and allTimes:
        t0 = min(allTimes)
        for curveName, keys in allCurves.items():
            allCurves[curveName] = [[float(t - t0), float(v)] for t, v in keys]
        allTimes = [t - t0 for t in allTimes]

    payload = {
        "fps": int(round(sceneFps)),
        "duration": float(max(allTimes)) if allTimes else 0.0,
        "curves": allCurves,
    }

    Path(outPath).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    manager.Destroy()


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 2:
        raise SystemExit("Usage: python script.py input.fbx output.json")

    fbxCustomPropsToJson(args[0], args[1])