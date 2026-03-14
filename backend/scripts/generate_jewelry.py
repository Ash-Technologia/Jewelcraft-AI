"""
Blender Python script — Generates parametric jewelry models.
Usage: blender --background --python generate_jewelry.py -- --params params.json --output output.glb

Supports: ring, bracelet, pendant, chain, earring, cufflink
Applies: metal materials, stone placement, surface patterns (normal maps), engraving text,
         multi-stone (pavé, halo, side-stone) configurations
"""

import bpy
import sys
import json
import math
import os


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


# ── Material helpers ───────────────────────────────────────────────────────────

def create_metal_material(metal_type, metal_color, roughness=0.15, pattern_path=None, pattern_intensity=0.5):
    """Create PBR metal material with optional normal-map pattern."""
    mat = bpy.data.materials.new(name=f"Metal_{metal_type}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = hex_to_rgba(metal_color)
    bsdf.inputs['Metallic'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = roughness
    try:
        bsdf.inputs['Specular IOR Level'].default_value = 0.5
    except KeyError:
        pass

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    if pattern_path and os.path.exists(pattern_path):
        tex = nodes.new('ShaderNodeTexImage')
        tex.location = (-600, -200)
        tex.image = bpy.data.images.load(pattern_path)

        normal_map = nodes.new('ShaderNodeNormalMap')
        normal_map.location = (-300, -200)
        normal_map.inputs['Strength'].default_value = pattern_intensity

        uv = nodes.new('ShaderNodeTexCoord')
        uv.location = (-900, -200)
        mapping = nodes.new('ShaderNodeMapping')
        mapping.location = (-750, -200)
        mapping.inputs['Scale'].default_value = (4.0, 4.0, 4.0)

        links.new(uv.outputs['UV'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
        links.new(tex.outputs['Color'], normal_map.inputs['Color'])
        links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])

    return mat


def create_stone_material(stone_type, stone_color, ior=2.42, transmission=0.95):
    """Create gemstone material with realistic refraction and dispersion."""
    mat = bpy.data.materials.new(name=f"Stone_{stone_type}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = hex_to_rgba(stone_color)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.02
    try:
        bsdf.inputs['Transmission Weight'].default_value = transmission
    except KeyError:
        try:
            bsdf.inputs['Transmission'].default_value = transmission
        except KeyError:
            pass
    bsdf.inputs['IOR'].default_value = ior

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat


def hex_to_rgba(hex_color):
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return (r, g, b, 1.0)


# ── Stone placement helpers ────────────────────────────────────────────────────

def place_center_stone(stone_spec, stone_mat, location=(0, 0, 0), size_override=None):
    """Place a single gemstone at the given location."""
    size = size_override if size_override else stone_spec.get('size', 1.0) * 0.3
    bpy.ops.mesh.primitive_ico_sphere_add(
        radius=size, subdivisions=3, location=location
    )
    stone = bpy.context.active_object
    stone.name = "Center_Stone"
    if stone_mat:
        stone.data.materials.append(stone_mat)
    return stone


def place_halo_stones(halo_params, stone_mat, center_z, count_override=None):
    """Place a ring of small halo stones around the center stone."""
    if not halo_params.get('enabled', False):
        return
    count = count_override or halo_params.get('stoneCount', 16)
    size  = halo_params.get('stoneSize', 0.03)
    for i in range(count):
        angle = (i / count) * math.pi * 2
        px = math.cos(angle) * 0.38
        py = math.sin(angle) * 0.38
        bpy.ops.mesh.primitive_ico_sphere_add(
            radius=size, subdivisions=2,
            location=(px, py, center_z)
        )
        h = bpy.context.active_object
        h.name = f"Halo_Stone_{i}"
        if stone_mat:
            h.data.materials.append(stone_mat)


def place_side_stones(stones_list, stone_mat, ring_radius=0.9):
    """Place additional side stones along the band for multi-stone designs."""
    if len(stones_list) <= 1:
        return
    for idx, s in enumerate(stones_list[1:], start=1):
        # Spread evenly left and right of center
        angle_offset = (idx * 0.3) * (1 if idx % 2 == 0 else -1)
        px = math.sin(angle_offset) * (ring_radius * 0.7)
        py = 0
        pz = ring_radius + s.get('size', 0.5) * 0.15
        size = s.get('size', 0.5) * 0.18
        bpy.ops.mesh.primitive_ico_sphere_add(
            radius=size, subdivisions=2,
            location=(px, py, pz)
        )
        ss = bpy.context.active_object
        ss.name = f"Side_Stone_{idx}"
        if stone_mat:
            ss.data.materials.append(stone_mat)


def place_prongs(prong_params, stone_size, ring_radius, metal_mat):
    """Place prong wires around the center stone."""
    count = prong_params.get('count', 4)
    if count <= 0:
        return
    thickness = prong_params.get('thickness', 0.9) * 0.022
    height    = prong_params.get('height', 1.2) * stone_size
    for i in range(count):
        angle = (i / count) * math.pi * 2
        px = math.cos(angle) * stone_size * 0.72
        py = math.sin(angle) * stone_size * 0.72
        bpy.ops.mesh.primitive_cylinder_add(
            radius=thickness,
            depth=height,
            location=(px, py, ring_radius + stone_size * 0.3)
        )
        prong = bpy.context.active_object
        prong.name = f"Prong_{i}"
        if metal_mat:
            prong.data.materials.append(metal_mat)


# ── Jewelry generators ─────────────────────────────────────────────────────────

def generate_ring(params, metal_mat, stone_mat):
    """Generate a parametric ring with center stone, prongs, halo, and side stones."""
    band_width  = params.get('band', {}).get('width', 3.0) / 10
    ring_radius = 0.9

    # Band torus
    bpy.ops.mesh.primitive_torus_add(
        major_radius=ring_radius,
        minor_radius=band_width * 0.5 + 0.02,
        major_segments=64,
        minor_segments=32,
    )
    ring = bpy.context.active_object
    ring.name = "Ring_Band"
    if metal_mat:
        ring.data.materials.append(metal_mat)

    # Center stone
    stones = params.get('stones', [])
    stone_size = 0.3
    if stones and stone_mat:
        stone_size = stones[0].get('size', 1.0) * 0.3
        place_center_stone(stones[0], stone_mat,
                           location=(0, 0, ring_radius + stone_size * 0.6),
                           size_override=stone_size)

    # Halo
    place_halo_stones(
        params.get('halo', {}), stone_mat,
        center_z=ring_radius + stone_size * 0.55
    )

    # Side stones (multi-stone rings)
    place_side_stones(stones, stone_mat, ring_radius)

    # Prongs
    if stones:
        place_prongs(params.get('prongs', {}), stone_size, ring_radius, metal_mat)

    # Bezel collar (if bezel setting)
    setting = params.get('setting', {}).get('type', 'prong')
    if setting == 'bezel' and stones:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=stone_size * 1.05,
            depth=stone_size * 0.5,
            location=(0, 0, ring_radius + stone_size * 0.4)
        )
        bezel = bpy.context.active_object
        bezel.name = "Bezel_Collar"
        if metal_mat:
            bezel.data.materials.append(metal_mat)


def generate_bracelet(params, metal_mat, stone_mat):
    """Generate a parametric bracelet / bangle."""
    band_width = params.get('band', {}).get('width', 6.0) / 10
    bpy.ops.mesh.primitive_torus_add(
        major_radius=3.0,
        minor_radius=band_width * 0.5,
        major_segments=64,
        minor_segments=24,
    )
    bracelet = bpy.context.active_object
    bracelet.name = "Bracelet_Band"
    if metal_mat:
        bracelet.data.materials.append(metal_mat)

    # Optional stones on bracelet
    stones = params.get('stones', [])
    if stones and stone_mat:
        stone_size = stones[0].get('size', 0.8) * 0.15
        # Place up to 5 accent stones across the top arc
        for i in range(min(5, len(stones) * 3)):
            angle = (i - 2) * 0.18
            px = math.sin(angle) * 3.0
            py = -math.cos(angle) * 3.0
            pz = band_width * 0.5 + stone_size
            bpy.ops.mesh.primitive_ico_sphere_add(
                radius=stone_size, subdivisions=2,
                location=(px, py, pz)
            )
            s = bpy.context.active_object
            s.name = f"Bracelet_Stone_{i}"
            s.data.materials.append(stone_mat)


def generate_pendant(params, metal_mat, stone_mat):
    """Generate a parametric pendant with base, bail, center stone, and halo."""
    # Base plate
    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=0.15, location=(0, 0, 0))
    base = bpy.context.active_object
    base.name = "Pendant_Base"
    if metal_mat:
        base.data.materials.append(metal_mat)

    # Bail (loop at top for chain attachment)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.22, minor_radius=0.055,
        location=(0, 0, 1.15)
    )
    bail = bpy.context.active_object
    bail.name = "Bail"
    if metal_mat:
        bail.data.materials.append(metal_mat)

    # Center stone
    stones = params.get('stones', [])
    stone_size = 0.35
    if stones and stone_mat:
        stone_size = stones[0].get('size', 1.0) * 0.35
        place_center_stone(stones[0], stone_mat, location=(0, 0, 0.12), size_override=stone_size)

    # Halo
    place_halo_stones(params.get('halo', {}), stone_mat, center_z=0.13)

    # Prongs on pendant
    if stones:
        place_prongs(params.get('prongs', {}), stone_size, 0.0, metal_mat)


def generate_chain(params, metal_mat, _stone_mat):
    """Generate a chain with interlocked torus links."""
    link_count = 30
    link_radius = 0.15
    spacing = link_radius * 3.5

    for i in range(link_count):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=link_radius,
            minor_radius=link_radius * 0.25,
            major_segments=16,
            minor_segments=8,
            location=(0, i * spacing, 0),
            rotation=(math.pi / 2 if i % 2 == 0 else 0, 0, 0)
        )
        link = bpy.context.active_object
        link.name = f"Chain_Link_{i}"
        if metal_mat:
            link.data.materials.append(metal_mat)


def generate_earring(params, metal_mat, stone_mat):
    """
    Generate a parametric earring.
    Variants: stud (default), drop, hoop.
    - Stud: post + stone + optional small halo
    - Drop: post + connector wire + dangling stone
    - Hoop: small torus with optional charm
    """
    earring_style = params.get('earring_style', 'stud')

    if earring_style == 'hoop':
        # ── Hoop earring ──
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.55,
            minor_radius=0.055,
            major_segments=64,
            minor_segments=16,
        )
        hoop = bpy.context.active_object
        hoop.name = "Earring_Hoop"
        if metal_mat:
            hoop.data.materials.append(metal_mat)

        # Optional charm at bottom of hoop
        stones = params.get('stones', [])
        if stones and stone_mat:
            stone_size = stones[0].get('size', 0.5) * 0.12
            place_center_stone(stones[0], stone_mat,
                               location=(0, -0.55, 0), size_override=stone_size)

    elif earring_style == 'drop':
        # ── Drop / dangle earring ──
        # Post at top
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.04, depth=0.5, location=(0, 0, 0.25)
        )
        post = bpy.context.active_object
        post.name = "Earring_Post"
        if metal_mat:
            post.data.materials.append(metal_mat)

        # Small connector loop
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.06, minor_radius=0.015, location=(0, 0, -0.02)
        )
        loop = bpy.context.active_object
        loop.name = "Earring_Loop"
        if metal_mat:
            loop.data.materials.append(metal_mat)

        # Drop wire
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.025, depth=0.6, location=(0, 0, -0.35)
        )
        drop_wire = bpy.context.active_object
        drop_wire.name = "Earring_Drop_Wire"
        if metal_mat:
            drop_wire.data.materials.append(metal_mat)

        # Dangling stone at bottom
        stones = params.get('stones', [])
        if stones and stone_mat:
            stone_size = stones[0].get('size', 1.0) * 0.22
            place_center_stone(stones[0], stone_mat,
                               location=(0, 0, -0.72), size_override=stone_size)

            # Small prongs on drop stone
            place_prongs(params.get('prongs', {'count': 4, 'height': 0.8, 'thickness': 0.7}),
                         stone_size, -0.72, metal_mat)

    else:
        # ── Stud earring (default) ──
        # Post
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.035, depth=0.45, location=(0, 0, 0.225)
        )
        post = bpy.context.active_object
        post.name = "Earring_Post"
        if metal_mat:
            post.data.materials.append(metal_mat)

        # Setting cup
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.22, depth=0.08, location=(0, 0, -0.04)
        )
        cup = bpy.context.active_object
        cup.name = "Earring_Setting_Cup"
        if metal_mat:
            cup.data.materials.append(metal_mat)

        # Center stone
        stones = params.get('stones', [])
        stone_size = 0.18
        if stones and stone_mat:
            stone_size = stones[0].get('size', 1.0) * 0.18
            place_center_stone(stones[0], stone_mat,
                               location=(0, 0, stone_size * 0.5), size_override=stone_size)

        # Halo on stud
        place_halo_stones(params.get('halo', {}), stone_mat, center_z=stone_size * 0.4)

        # Prongs on stud
        if stones:
            place_prongs(params.get('prongs', {}), stone_size, 0.0, metal_mat)


# ── Lighting & camera ──────────────────────────────────────────────────────────

def setup_studio_lighting():
    """Perfect 3-point studio lighting for jewelry."""
    bpy.ops.object.light_add(type='AREA', location=(3, -2, 4))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 120
    key.data.size = 2

    bpy.ops.object.light_add(type='AREA', location=(-3, -1, 3))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = 45
    fill.data.size = 3

    bpy.ops.object.light_add(type='AREA', location=(0, 3, 2))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = 65
    rim.data.size = 1.5

    # Extra top highlight for gem sparkle
    bpy.ops.object.light_add(type='SPOT', location=(0, 0, 5))
    top = bpy.context.active_object
    top.name = "Top_Light"
    top.data.energy = 300
    top.data.spot_size = math.radians(30)
    top.data.spot_blend = 0.3


def setup_camera():
    """Position camera for a product-shot angle."""
    bpy.ops.object.camera_add(location=(4, -4, 3))
    cam = bpy.context.active_object
    cam.rotation_euler = (math.radians(60), 0, math.radians(45))
    bpy.context.scene.camera = cam


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []

    params_file = 'params.json'
    output_file = 'output.glb'

    i = 0
    while i < len(argv):
        if argv[i] == '--params' and i + 1 < len(argv):
            params_file = argv[i + 1]; i += 2
        elif argv[i] == '--output' and i + 1 < len(argv):
            output_file = argv[i + 1]; i += 2
        else:
            i += 1

    with open(params_file, 'r') as f:
        params = json.load(f)

    clear_scene()

    # Resolve textures
    pattern_path      = params.get('pattern_texture_path', None)
    pattern_intensity = params.get('pattern_intensity', 0.5)

    # Materials
    metal = params.get('metal', {})
    metal_mat = create_metal_material(
        metal.get('type', 'gold'),
        metal.get('color', '#FFD700'),
        metal.get('roughness', 0.15),
        pattern_path,
        pattern_intensity,
    )

    # Stone material — use first stone's spec
    stones = params.get('stones', [{}])
    stone_mat = None
    if stones:
        s = stones[0]
        stone_mat = create_stone_material(
            s.get('type', 'diamond'),
            s.get('color', '#FFFFFF'),
            s.get('ior', 2.42),
            s.get('transmission', 0.95),
        )

    # Dispatch table
    jewelry_type = params.get('jewelry_type', 'ring')
    generators = {
        'ring':     generate_ring,
        'bracelet': generate_bracelet,
        'bangle':   generate_bracelet,
        'pendant':  generate_pendant,
        'chain':    generate_chain,
        'necklace': generate_chain,
        'earring':  generate_earring,
        'stud':     generate_earring,
    }
    gen_func = generators.get(jewelry_type, generate_ring)
    gen_func(params, metal_mat, stone_mat)

    setup_studio_lighting()
    setup_camera()

    # Export
    ext = os.path.splitext(output_file)[1].lower()
    if ext in ('.glb', '.gltf'):
        bpy.ops.export_scene.gltf(filepath=output_file, export_format='GLB')
    elif ext == '.stl':
        try:
            bpy.ops.wm.stl_export(filepath=output_file)
        except AttributeError:
            bpy.ops.export_mesh.stl(filepath=output_file)
    elif ext == '.fbx':
        bpy.ops.export_scene.fbx(filepath=output_file)
    else:
        bpy.ops.export_scene.gltf(filepath=output_file, export_format='GLB')

    print(f"✅ JewelCraft: Exported {jewelry_type} → {output_file}")


if __name__ == '__main__':
    main()
