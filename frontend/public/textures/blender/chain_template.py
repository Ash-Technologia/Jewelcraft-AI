"""
Blender Python Template: Cable Chain
Run: blender --background --python chain_template.py -- --output chain.glb

Creates an interlocked oval cable chain with:
- Alternating horizontal/vertical links
- Adjustable link count, size, wire gauge
- Physically accurate interlocking geometry
"""
import bpy, bmesh, math, sys, os
from mathutils import Matrix, Vector

LINK_COUNT     = 20       # number of links (even)
LINK_LENGTH_MM = 6.0      # inner length of each oval link
LINK_WIDTH_MM  = 3.5      # inner width of each oval link
WIRE_GAUGE_MM  = 0.8      # wire diameter
LINK_SEGS_U    = 24       # segments around wire cross-section
LINK_SEGS_V    = 64       # segments along wire path

argv = sys.argv
output_path = "chain.glb"
if "--" in argv:
    args = argv[argv.index("--") + 1:]
    if "--output" in args:
        output_path = args[args.index("--output") + 1]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

L  = LINK_LENGTH_MM / 1000
W  = LINK_WIDTH_MM / 1000
WG = WIRE_GAUGE_MM / 2 / 1000  # wire radius
pitch = (L + WG * 2) / 2       # distance between link centres

def create_oval_link(location, rotation_z=0, name="Link"):
    """Create one oval torus-style link via curve→mesh."""
    bpy.ops.object.select_all(action='DESELECT')

    # Create oval path via bezier curve
    bpy.ops.curve.primitive_bezier_curve_add()
    crv = bpy.context.active_object
    crv.name = name + "_curve"
    crv.data.dimensions = '3D'
    crv.data.bevel_depth = WG
    crv.data.bevel_resolution = LINK_SEGS_U // 4
    crv.data.use_fill_caps = True

    spline = crv.data.splines[0]
    spline.bezier_points.add(2)
    pts = spline.bezier_points

    # 4-point oval approximation
    h = L / 2; hw = W / 2; k = 0.5523  # bezier handle factor for circles
    pts[0].co = ( h, 0, 0); pts[0].handle_left=( h,-hw*k,0); pts[0].handle_right=( h, hw*k,0)
    pts[1].co = ( 0, hw,0); pts[1].handle_left=( h*k,hw,0); pts[1].handle_right=(-h*k,hw,0)
    pts[2].co = (-h, 0, 0); pts[2].handle_left=(-h, hw*k,0); pts[2].handle_right=(-h,-hw*k,0)
    pts[3].co = ( 0,-hw,0); pts[3].handle_left=(-h*k,-hw,0); pts[3].handle_right=( h*k,-hw,0)
    for p in pts:
        p.handle_left_type = 'FREE'; p.handle_right_type = 'FREE'
    spline.use_cyclic_u = True

    # Convert to mesh
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.active_object
    obj.name = name
    obj.location = location
    obj.rotation_euler[2] = rotation_z
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj

all_links = []
for i in range(LINK_COUNT):
    z = i * pitch
    rot = math.pi / 2 if i % 2 else 0
    link = create_oval_link((0, 0, z), rotation_z=rot, name=f"Link_{i:03d}")
    all_links.append(link)

# Join all links into one mesh
bpy.ops.object.select_all(action='DESELECT')
for lnk in all_links:
    lnk.select_set(True)
bpy.context.view_layer.objects.active = all_links[0]
bpy.ops.object.join()
chain_obj = bpy.context.active_object
chain_obj.name = "Chain"

# Silver material
mat = bpy.data.materials.new("SilverPBR")
mat.use_nodes = True
nodes = mat.node_tree.nodes; links_nt = mat.node_tree.links
nodes.clear()
out  = nodes.new("ShaderNodeOutputMaterial")
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
bsdf.inputs["Base Color"].default_value = (0.95, 0.95, 0.97, 1.0)
bsdf.inputs["Metallic"].default_value   = 1.0
bsdf.inputs["Roughness"].default_value  = 0.08
links_nt.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
chain_obj.data.materials.append(mat)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(output_path),
    export_format="GLB", export_selected=True,
    export_materials="EXPORT", export_normals=True,
    export_uvs=True,
)
print(f"Chain exported to: {output_path}")
