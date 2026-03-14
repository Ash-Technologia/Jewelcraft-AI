"""
Blender Python Template: Bangle Bracelet
Run: blender --background --python bracelet_template.py -- --output bracelet.glb

Creates a solid bangle bracelet with:
- Standard wrist diameter (65mm opening)
- Rounded D-profile cross section
- Optional inner flat / outer domed finish
"""
import bpy, bmesh, math, sys, os

WRIST_DIAMETER_MM = 65.0   # inner opening diameter
BAND_HEIGHT_MM    = 10.0   # height of bangle
THICKNESS_MM      = 4.0    # cross-section depth
PROFILE_SEGS      = 16     # cross-section resolution
RING_SEGS         = 128    # circumference resolution

argv = sys.argv
output_path = "bracelet.glb"
if "--" in argv:
    args = argv[argv.index("--") + 1:]
    if "--output" in args:
        output_path = args[args.index("--output") + 1]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

inner_r   = WRIST_DIAMETER_MM / 2 / 1000
mid_r     = inner_r + THICKNESS_MM / 2 / 1000
half_h    = BAND_HEIGHT_MM / 2 / 1000
cross_rx  = THICKNESS_MM / 2 / 1000
cross_ry  = BAND_HEIGHT_MM / 2 / 1000

mesh = bpy.data.meshes.new("BraceletMesh")
obj  = bpy.data.objects.new("Bracelet", mesh)
bpy.context.collection.objects.link(obj)

bm = bmesh.new()

# Build torus with D-profile cross section
all_verts = []
for i in range(RING_SEGS):
    ring_a = (i / RING_SEGS) * 2 * math.pi
    row = []
    for j in range(PROFILE_SEGS):
        prof_a = (j / PROFILE_SEGS) * 2 * math.pi
        # D-profile: outer half dome, inner flat
        if math.cos(prof_a) > 0:  # outer side
            px = cross_rx * math.cos(prof_a)
        else:
            px = cross_rx * math.cos(prof_a) * 0.3   # flat inner
        py = cross_ry * math.sin(prof_a)

        local_r = inner_r + cross_rx + px
        x = math.cos(ring_a) * local_r
        y = math.sin(ring_a) * local_r
        z = py
        row.append(bm.verts.new((x, y, z)))
    all_verts.append(row)

bm.verts.ensure_lookup_table()

for i in range(RING_SEGS):
    ni = (i + 1) % RING_SEGS
    for j in range(PROFILE_SEGS):
        nj = (j + 1) % PROFILE_SEGS
        bm.faces.new([
            all_verts[i][j], all_verts[ni][j],
            all_verts[ni][nj], all_verts[i][nj]
        ])

bm.to_mesh(mesh)
bm.free()
mesh.validate()

bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project()
bpy.ops.object.mode_set(mode='OBJECT')

# Rose gold material
mat = bpy.data.materials.new("RoseGoldPBR")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()
output = nodes.new("ShaderNodeOutputMaterial")
bsdf   = nodes.new("ShaderNodeBsdfPrincipled")
bsdf.inputs["Base Color"].default_value = (0.8, 0.45, 0.38, 1.0)
bsdf.inputs["Metallic"].default_value   = 1.0
bsdf.inputs["Roughness"].default_value  = 0.12
links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
obj.data.materials.append(mat)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(output_path),
    export_format="GLB", export_selected=True,
    export_materials="EXPORT", export_normals=True,
    export_uvs=True, export_tangents=True,
)
print(f"Bracelet exported to: {output_path}")
