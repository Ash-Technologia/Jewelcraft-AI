import os

file_path = "c:/Users/user/Downloads/Jewel-AI/Jewel-AI/frontend/src/pages/Generate.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Imports
text = text.replace("import '@tensorflow/tfjs'\nimport * as mobilenet from '@tensorflow-models/mobilenet'\n", "import { detectJewelryType } from './jewelryDetector'\n")

# 2. Function block
block_start = text.find("// ── VISION-BASED DETECTION")
block_end = text.find("// ── Combine all detection signals")
if block_start != -1 and block_end != -1:
    text = text[:block_start] + text[block_end:]

# 3. visionPromise
old_prom = """const visionPromise = (!forcedType && imageUrl)
            ? detectTypeFromVision(imageUrl)
            : Promise.resolve({ type: jType, confidence: 0, features: undefined })"""
new_prom = """const visionPromise = (!forcedType && imageUrl)
            ? detectJewelryType(imageUrl, file?.name)
            : Promise.resolve({ type: jType, confidence: 0.0, features: undefined })"""
text = text.replace(old_prom, new_prom)

# 4. confidence
text = text.replace("if (visionResult.confidence > 0.15 && visionResult.type) {", "if (visionResult.confidence > 0.42 && visionResult.type) {")

# 5. remaining steps
old_steps = """const remainingSteps = [
            `> Running object detection pass...`,
            `> Detected: ${typeLog.toUpperCase()} (confidence: ${conf})`,
            `> Classifying jewelry category → ${typeLog.toUpperCase()}`,
            '> Analyzing metal properties...',
            '> Detecting stone arrangement...',
            '> Extracting component positions...',
            '> Computing Style DNA vectors...',
            '> Analysis complete ✓',
        ]"""
new_steps = """const remainingSteps = [
            `> Running geometric shape analysis...`,
            `> Running symmetry analysis...`,
            `> Running edge topology scan...`,
            `> Running spatial mass distribution...`,
            `> Ensemble vote: ${typeLog.toUpperCase()} (p=${conf})`,
            `> Classifying jewelry category → ${typeLog.toUpperCase()}`,
            '> Analyzing metal properties...',
            '> Detecting stone arrangement...',
            '> Extracting component positions...',
            '> Computing Style DNA vectors...',
            '> Analysis complete ✓',
        ]"""
text = text.replace(old_steps, new_steps)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Patch applied successfully.")
