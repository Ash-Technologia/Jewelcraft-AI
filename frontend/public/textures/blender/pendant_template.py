"""
Blender Python Template: Drop Pendant
Run: blender --background --python pendant_template.py -- --output pendant.glb

Creates a teardrop pendant with:
- Bail (loop for chain attachment) at top
- Flat/domed front face for stone setting or engraving
- Optional bezel setting placeholder
- UV-mapped for texture/normal maps
"""
import bpy, bmesh, math, sys, os

PENDANT_HEIGHT_MM  = 25.0
PENDANT_WIDTH_MM   = 15.0
PENDANT_DEPTH_MM   = 4.0
BAIL_INNER_MM      = 3.0
BAIL_WIRE_MM       = 1.2
PROFILE            = "dome"   # flat | dome | double_dome

argv = sys.argv
output_path = "pendant.glb"
if "--" in argv:
    args = argv[argv.index("--") + 1:]
    if "--output" in args:
        output_path = args[args.index("--output") + 1]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

H  = PENDANT_HEIGHT_MM / 1000
W  = PENDANT_WIDTH_MM  / 1000
D  = PENDANT_DEPTH_MM  / 1000

SEGS = 64  # circumference resolution

mesh = bpy.data.meshes.new("PendantMesh")
obj  = bpy.data.objects.new("Pendant", mesh)
bpy.context.collection.objects.link(obj)

bm = bmesh.new()

# Teardrop profile: circle bottom + tapered top point
def teardrop_radius(angle):
    """Returns radius at given angle (0=right, π/2=top)"""
    # Blend from full circle at bottom to teardrop at top
    t = (math.sin(angle) + 1) / 2   # 0 at bottom, 1 at top
    circle_r = W / 2
    taper    = circle_r * (1 - t**2)
    return max(0.001, taper)

def dome_z(rx, ry):
    """Dome offset for front face"""
    if PROFILE == "flat": return 0
    r = math.sqrt(rx**2 + ry**2)
    max_r = max(W/2, H/2)
    return D * 0.4 * max(0, 1 - (r / max_r)**2)

# Build pendant body as loft of teardrop cross sections
layers = 32
verts_by_layer = []
for li in range(layers + 1):
    t = li / layers   # 0=bottom, 1=top
    # y position: -H/2 at bottom, H/2 at top (shifted up for bail)
    cy = -H/2 + t * H
    # Radius narrows toward top
    layer_scale = math.sin(t * math.pi) ** 0.7
    if layer_scale < 0.01: layer_scale = 0.01

    row = []
    for si in range(SEGS):
        angle = (si / SEGS) * 2 * math.pi
        base_r = (W / 2) * layer_scale
        rx = math.cos(angle) * base_r
        ry_local = math.sin(angle) * base_r * 0.6   # flatten slightly
        dz = dome_z(rx / (W/2), cy / (H/2))
        if math.cos(angle) > 0:  # front face dome
            z = D / 2 + dz
        else:
            z = -D / 2
        row.append(bm.verts.new((rx, cy, z)))
    verts_by_layer.append(row)

bm.verts.ensure_lookup_table()

for li in range(layers):
    for si in range(SEGS):
        nsi = (si + 1) % SEGS
        bm.faces.new([
            verts_by_layer[li][si],
            verts_by_layer[li+1][si],
            verts_by_layer[li+1][nsi],
            verts_by_layer[li][nsi],
        ])

# Cap top and bottom
def cap_fan(layer_verts, is_top):
    cx = sum(v.co.x for v in layer_verts) / len(layer_verts)
    cy_val = sum(v.co.y for v in layer_verts) / len(layer_verts)
    cz = sum(v.co.z for v in layer_verts) / len(layer_verts)
    center = bm.verts.new((cx, cy_val, cz))
    n = len(layer_verts)
    for i in range(n):
        j = (i + 1) % n
        if is_top:
            bm.faces.new([center, layer_verts[j], layer_verts[i]])
        else:
            bm.faces.new([center, layer_verts[i], layer_verts[j]])

cap_fan(verts_by_layer[0], False)
cap_fan(verts_by_layer[-1], True)

bm.to_mesh(mesh)
bm.free()

# Add bail (torus at top)
bail_ir   = BAIL_INNER_MM / 2 / 1000
bail_wire = BAIL_WIRE_MM / 1000
bpy.ops.mesh.primitive_torus_add(
    major_radius=bail_ir + bail_wire,
    minor_radius=bail_wire,
    major_segments=32, minor_segments=12,
    location=(0, H/2 + bail_ir + bail_wire, 0)
)
bail = bpy.context.active_object
bail.name = "Bail"

# Join pendant + bail
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True); bail.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.join()

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=66)
bpy.ops.object.mode_set(mode='OBJECT')

# Platinum material
mat = bpy.data.materials.new("PlatinumPBR")
mat.use_nodes = True
nodes = mat.node_tree.nodes; links_nt = mat.node_tree.links
nodes.clear()
out  = nodes.new("ShaderNodeOutputMaterial")
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
bsdf.inputs["Base Color"].default_value = (0.91, 0.91, 0.93, 1.0)
bsdf.inputs["Metallic"].default_value   = 1.0
bsdf.inputs["Roughness"].default_value  = 0.06
bsdf.inputs["Specular IOR Level"].default_value = 0.6
links_nt.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
obj.data.materials.append(mat)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(output_path),
    export_format="GLB", export_selected=True,
    export_materials="EXPORT", export_normals=True,
    export_uvs=True, export_tangents=True,
)
print(f"Pendant exported to: {output_path}")
