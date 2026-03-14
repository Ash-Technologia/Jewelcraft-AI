"""
Blender Python Template: Ring
Run: blender --background --python ring_template.py -- --output ring.glb

Creates a parametric band ring with:
- Adjustable band width, thickness, inner diameter
- Optional flat/comfort-fit/cathedral profile
- UV-unwrapped for texture mapping
- PBR gold material preset
- Exports as GLB
"""
import bpy, bmesh, math, sys, os

# ── Parameters ──────────────────────────────
INNER_DIAMETER_MM = 17.35   # US size 7 ≈ 17.35mm
BAND_WIDTH_MM     = 6.0     # Width of band (height of cylinder)
THICKNESS_MM      = 1.8     # Wall thickness
SEGMENTS          = 96      # Smoothness of ring circle
PROFILE           = "comfort_fit"  # flat | comfort_fit | cathedral

# Parse CLI args: blender ... -- --output foo.glb
argv = sys.argv
output_path = "ring.glb"
if "--" in argv:
    args = argv[argv.index("--") + 1:]
    if "--output" in args:
        output_path = args[args.index("--output") + 1]

# ── Setup ────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

inner_r = INNER_DIAMETER_MM / 2 / 1000   # metres
outer_r = inner_r + THICKNESS_MM / 1000
half_w  = BAND_WIDTH_MM / 2 / 1000

# ── Build mesh ──────────────────────────────
mesh = bpy.data.meshes.new("RingMesh")
obj  = bpy.data.objects.new("Ring", mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj

bm = bmesh.new()

def ring_vertex(angle, radius, z):
    return bm.verts.new((
        math.cos(angle) * radius,
        math.sin(angle) * radius,
        z
    ))

# Build quad strips for inner, outer, top, bottom faces
verts_outer_top    = []
verts_outer_bottom = []
verts_inner_top    = []
verts_inner_bottom = []

for i in range(SEGMENTS):
    a = (i / SEGMENTS) * 2 * math.pi

    # Comfort fit: slight convex curve on outer face
    if PROFILE == "comfort_fit":
        curve = math.cos((half_w / outer_r) * 0.5) * 0.0001
    else:
        curve = 0

    verts_outer_top.append(   ring_vertex(a, outer_r, +half_w - curve))
    verts_outer_bottom.append(ring_vertex(a, outer_r, -half_w + curve))
    verts_inner_top.append(   ring_vertex(a, inner_r, +half_w))
    verts_inner_bottom.append(ring_vertex(a, inner_r, -half_w))

bm.verts.ensure_lookup_table()

def make_quad_strip(top_verts, bot_verts, flip=False):
    n = len(top_verts)
    for i in range(n):
        j = (i + 1) % n
        if flip:
            bm.faces.new([top_verts[i], top_verts[j], bot_verts[j], bot_verts[i]])
        else:
            bm.faces.new([bot_verts[i], bot_verts[j], top_verts[j], top_verts[i]])

# Outer wall
make_quad_strip(verts_outer_top, verts_outer_bottom, flip=True)
# Inner wall
make_quad_strip(verts_inner_top, verts_inner_bottom, flip=False)
# Top face
make_quad_strip(verts_outer_top, verts_inner_top, flip=False)
# Bottom face
make_quad_strip(verts_outer_bottom, verts_inner_bottom, flip=True)

bm.to_mesh(mesh)
bm.free()
mesh.validate()
mesh.calc_normals()

# Smart UV unwrap
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=66, island_margin=0.02)
bpy.ops.object.mode_set(mode='OBJECT')

# ── PBR Gold Material ───────────────────────
mat = bpy.data.materials.new("GoldPBR")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

output   = nodes.new("ShaderNodeOutputMaterial")
bsdf     = nodes.new("ShaderNodeBsdfPrincipled")
output.location = (400, 0)
bsdf.location   = (0, 0)

bsdf.inputs["Base Color"].default_value    = (1.0, 0.766, 0.336, 1.0)  # 18k gold
bsdf.inputs["Metallic"].default_value      = 1.0
bsdf.inputs["Roughness"].default_value     = 0.15
bsdf.inputs["Specular IOR Level"].default_value = 0.5

links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
obj.data.materials.append(mat)

# ── Export ───────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(output_path),
    export_format="GLB",
    export_selected=True,
    export_materials="EXPORT",
    export_normals=True,
    export_uvs=True,
    export_tangents=True,
)
print(f"Ring exported to: {output_path}")
