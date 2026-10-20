"""blender --background --factory-startup --python make_world.py -- <outdir> [preview]
Builds blaster.glb (first-person weapon + glove) and arena.glb (sci-fi hangar)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, math, random
import numpy as np
from mathutils import Vector
from lib import *

args = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(args[0])
PREVIEW = 'preview' in args
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)
random.seed(7)


# =================================================================== BLASTER
def blaster():
    reset()
    body = mat('GunBody', (0.36, 0.38, 0.42), metal=0.7, rough=0.32)
    dark = mat('GunDark', (0.03, 0.035, 0.045), metal=0.8, rough=0.35)
    accent = mat('GunAccent', (0.05, 0.25, 0.9), metal=0.5, rough=0.3)
    glow = mat('GunGlow', (0.2, 0.9, 1), metal=0, rough=0.3, emit=(0.15, 0.85, 1.0), strength=8)
    glove = mat('Glove', (0.3, 0.29, 0.27), metal=0.0, rough=0.9)
    plate = mat('GlovePlate', (0.12, 0.13, 0.15), metal=0.7, rough=0.4)
    parts = []
    # barrel along +Y (-> -Z in three = camera forward). Grip at origin.
    parts.append(box('receiver', (0.07, 0.26, 0.085), (0, 0.06, 0.06), body, bevel=0.012))
    parts.append(box('top', (0.05, 0.2, 0.03), (0, 0.04, 0.115), dark, bevel=0.008))
    parts.append(box('sight', (0.018, 0.04, 0.03), (0, -0.03, 0.14), dark, bevel=0.004))
    parts.append(box('sightglow', (0.008, 0.005, 0.012), (0, -0.052, 0.145), glow, bevel=0))
    parts.append(box('side_l', (0.008, 0.18, 0.04), (0.038, 0.07, 0.06), accent, bevel=0.004))
    parts.append(box('side_r', (0.008, 0.18, 0.04), (-0.038, 0.07, 0.06), accent, bevel=0.004))
    parts.append(box('stripe_l', (0.004, 0.16, 0.008), (0.043, 0.07, 0.075), glow, bevel=0))
    parts.append(box('stripe_r', (0.004, 0.16, 0.008), (-0.043, 0.07, 0.075), glow, bevel=0))
    parts.append(cyl('barrel', 0.022, 0.2, (0, 0.27, 0.065), dark, rot=(90, 0, 0), verts=14))
    for i in range(4):
        parts.append(torus('coil%d' % i, 0.03, 0.007, (0, 0.21 + i * 0.035, 0.065), glow, rot=(90, 0, 0), maj=18, mino=6))
    parts.append(cyl('muzzle', 0.034, 0.04, (0, 0.38, 0.065), body, rot=(90, 0, 0), verts=14, bevel=0.005))
    parts.append(cyl('muzzleglow', 0.02, 0.006, (0, 0.402, 0.065), glow, rot=(90, 0, 0), verts=14))
    parts.append(box('grip', (0.05, 0.07, 0.13), (0, -0.04, -0.03), dark, bevel=0.012, rot=(-14, 0, 0)))
    parts.append(box('guard', (0.04, 0.09, 0.012), (0, 0.03, 0.005), dark, bevel=0.004))
    parts.append(box('mag', (0.04, 0.05, 0.08), (0, 0.06, -0.01), accent, bevel=0.008))
    parts.append(box('magglow', (0.042, 0.03, 0.006), (0, 0.06, -0.02), glow, bevel=0))
    # glove + armoured sleeve gripping the weapon (comes in from below/behind the camera)
    parts.append(box('hand', (0.075, 0.085, 0.07), (0.0, -0.045, -0.005), glove, bevel=0.025, rot=(-14, 0, 0)))
    parts.append(box('fingers', (0.065, 0.03, 0.06), (0.0, 0.005, -0.03), glove, bevel=0.012))
    parts.append(box('thumb', (0.022, 0.06, 0.024), (0.035, -0.0, 0.03), glove, bevel=0.008))
    parts.append(cyl('wrist', 0.045, 0.1, (0.0, -0.12, -0.05), glove, rot=(70, 0, 0), verts=12))
    parts.append(cyl('sleeve', 0.058, 0.32, (0.0, -0.28, -0.11), glove, rot=(70, 0, 0), verts=12))
    parts.append(box('bracer', (0.09, 0.16, 0.035), (0.0, -0.25, -0.05), plate, bevel=0.01, rot=(-20, 0, 0)))
    parts.append(box('bracerglow', (0.04, 0.1, 0.004), (0.0, -0.25, -0.03), glow, bevel=0, rot=(-20, 0, 0)))
    gun = join(parts, 'Blaster')
    m = bpy.data.objects.new('MUZZLE', None)
    bpy.context.collection.objects.link(m)
    m.location = (0, 0.41, 0.065)
    m.parent = gun
    print('[blaster] tris=%d' % tri_count([gun]))
    export_glb(os.path.join(OUT, 'blaster.glb'))
    print('[blaster] size=%d' % os.path.getsize(os.path.join(OUT, 'blaster.glb')))


# =================================================================== TEXTURES
def noise(h, w, scale):
    small = rng.random((h // scale + 2, w // scale + 2))
    big = np.kron(small, np.ones((scale, scale)))[:h, :w]
    return big


def floor_textures(S=512):
    """2x2 metal plates per texture with bevels, bolts, hazard notches and cyan seams (emissive)."""
    base = np.zeros((S, S, 4), np.float32)
    emis = np.zeros((S, S, 4), np.float32)
    base[..., 3] = emis[..., 3] = 1
    g = 0.11 + 0.035 * noise(S, S, 64) + 0.02 * noise(S, S, 8) + 0.01 * rng.random((S, S))
    yy, xx = np.mgrid[0:S, 0:S]
    t = S // 2
    lx, ly = xx % t, yy % t
    edge = np.minimum(np.minimum(lx, t - 1 - lx), np.minimum(ly, t - 1 - ly))
    g = np.where(edge < 3, 0.03, g)
    g = np.where((edge >= 3) & (edge < 7), g + 0.07, g)
    # inner diamond plate pattern
    dp = ((xx + yy) % 16 < 2) | ((xx - yy) % 16 < 2)
    inner = (edge > 22)
    g = np.where(inner & dp, g + 0.03, g)
    # bolts
    for cx in (12, t - 13):
        for cy in (12, t - 13):
            d = np.hypot(lx - cx, ly - cy)
            g = np.where(d < 4.5, 0.32, g)
            g = np.where((d >= 4.5) & (d < 6), 0.04, g)
    col = np.stack([g * 0.92, g * 0.98, g * 1.08], -1)
    base[..., :3] = col
    # glowing seam: one horizontal + one vertical channel per texture
    seam = (yy < 2) | (xx < 2)
    emis[..., 0] = np.where(seam, 0.05, 0)
    emis[..., 1] = np.where(seam, 0.75, 0)
    emis[..., 2] = np.where(seam, 0.9, 0)
    base[..., :3] = np.where(seam[..., None], np.array([0.05, 0.4, 0.5]), base[..., :3])
    return image_from_array('floor_base', base), image_from_array('floor_emit', emis)


def wall_textures(S=512):
    base = np.zeros((S, S, 4), np.float32)
    emis = np.zeros((S, S, 4), np.float32)
    base[..., 3] = emis[..., 3] = 1
    yy, xx = np.mgrid[0:S, 0:S]
    g = 0.13 + 0.03 * noise(S, S, 32) + 0.012 * rng.random((S, S))
    # panel grid: 2 columns, 3 rows of different heights
    rows = [0, 140, 300, 512]
    cols = [0, 256, 512]
    for r in rows:
        g = np.where(np.abs(yy - r) < 3, 0.035, g)
    for c in cols:
        g = np.where(np.abs(xx - c) < 3, 0.035, g)
    # vent slats in the middle row
    vent = (yy > 170) & (yy < 270) & (xx % 256 > 40) & (xx % 256 < 216) & ((yy // 8) % 2 == 0)
    g = np.where(vent, 0.04, g)
    # small screens / lights
    light = (yy > 330) & (yy < 342) & (xx % 256 > 30) & (xx % 256 < 110)
    green = (yy > 60) & (yy < 70) & (xx % 256 > 150) & (xx % 256 < 230)
    base[..., 0] = g * 0.95
    base[..., 1] = g * 1.0
    base[..., 2] = g * 1.12
    emis[..., 0] = np.where(light, 0.1, 0)
    emis[..., 1] = np.where(light, 0.8, np.where(green, 1.0, 0))
    emis[..., 2] = np.where(light, 1.0, np.where(green, 0.35, 0))
    return image_from_array('wall_base', base), image_from_array('wall_emit', emis)


# =================================================================== ARENA
def arena():
    reset()
    W, L, Hh = 18.0, 40.0, 7.0          # width (x), length (y), height
    fb, fe = floor_textures()
    wb, we = wall_textures()
    m_floor = tex_mat('Floor', fb, fe, emit_strength=0.8, metal=0.7, rough=0.35)
    m_wall = tex_mat('Wall', wb, we, emit_strength=3.0, metal=0.6, rough=0.5)
    frame = mat('ArenaFrame', (0.05, 0.055, 0.065), metal=0.85, rough=0.35)
    steel = mat('ArenaSteel', (0.25, 0.27, 0.3), metal=0.9, rough=0.3)
    cyan = mat('NeonCyan', (0.1, 0.9, 1), metal=0, rough=0.4, emit=(0.1, 0.85, 1.0), strength=10)
    green = mat('NeonGreen', (0.2, 1, 0.4), metal=0, rough=0.4, emit=(0.15, 1.0, 0.35), strength=8)
    white = mat('NeonWhite', (1, 1, 1), metal=0, rough=0.4, emit=(0.75, 0.9, 1.0), strength=6)
    red = mat('NeonRed', (1, 0.1, 0.1), metal=0, rough=0.4, emit=(1.0, 0.08, 0.06), strength=10)
    orange = mat('NeonOrange', (1, 0.5, 0.1), metal=0, rough=0.4, emit=(1.0, 0.45, 0.05), strength=8)
    crate_m = mat('Crate', (0.18, 0.2, 0.24), metal=0.7, rough=0.45)
    console_scr = mat('ConsoleScreen', (0.05, 0.3, 0.4), metal=0, rough=0.2, emit=(0.05, 0.45, 0.6), strength=4)
    objs = []

    # floor (UV repeats every 4 m)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    fl = bpy.context.active_object; fl.name = 'Floor'; fl.scale = (W, L, 1)
    bpy.ops.object.transform_apply(scale=True)
    fl.data.materials.append(m_floor); world_uv(fl, 4.0); objs.append(fl)
    # walls + ceiling (boxes with world UVs)
    for nm, size, loc in [('WallL', (0.4, L, Hh), (W / 2 + 0.2, 0, Hh / 2)), ('WallR', (0.4, L, Hh), (-W / 2 - 0.2, 0, Hh / 2)),
                          ('WallFar', (W, 0.4, Hh), (0, L / 2 + 0.2, Hh / 2)), ('WallNear', (W, 0.4, Hh), (0, -L / 2 - 0.2, Hh / 2))]:
        o = box(nm, size, loc, m_wall, bevel=0); world_uv(o, 3.5); objs.append(o)
    ceil = box('Ceiling', (W, L, 0.3), (0, 0, Hh + 0.15), frame, bevel=0); objs.append(ceil)

    # modular wall panels + light strips every 4 m along the side walls
    for s in (1, -1):
        x = s * (W / 2 - 0.15)
        for i in range(10):
            y = -L / 2 + 2 + i * 4
            objs.append(box('pillar%d_%d' % (s, i), (0.5, 0.6, Hh), (x - s * 0.1, y, Hh / 2), frame, bevel=0.04))
            objs.append(box('pillarglow%d_%d' % (s, i), (0.04, 0.05, Hh - 1.6), (x - s * 0.36, y, Hh / 2 + 0.3),
                            cyan if i % 2 == 0 else green, bevel=0))
            objs.append(box('kick%d_%d' % (s, i), (0.3, 3.4, 0.35), (x - s * 0.05, y + 2, 0.175), steel, bevel=0.03))
            objs.append(box('kickglow%d_%d' % (s, i), (0.02, 3.0, 0.03), (x - s * 0.21, y + 2, 0.3), cyan, bevel=0))
            if i % 3 == 1:
                objs.append(box('screen%d_%d' % (s, i), (0.06, 1.6, 0.9), (x - s * 0.02, y + 2, 2.4), frame, bevel=0.02))
                objs.append(box('screenglow%d_%d' % (s, i), (0.01, 1.45, 0.75), (x - s * 0.06, y + 2, 2.4), console_scr, bevel=0))
            # horizontal strip high on the wall
            objs.append(box('hstrip%d_%d' % (s, i), (0.03, 3.4, 0.05), (x - s * 0.05, y + 2, 4.6), white, bevel=0))
        # cable tray
        objs.append(box('tray%d' % s, (0.5, L, 0.12), (x - s * 0.3, 0, 5.6), steel, bevel=0.02))
    # ceiling beams + light panels
    for i in range(11):
        y = -L / 2 + i * 4
        objs.append(box('beam%d' % i, (W, 0.5, 0.6), (0, y, Hh - 0.3), frame, bevel=0.04))
        objs.append(box('beamglow%d' % i, (W - 1, 0.04, 0.04), (0, y - 0.26, Hh - 0.5), cyan, bevel=0))
        if i < 10:
            for x in (-4.5, 0, 4.5):
                objs.append(box('lamp%d_%d' % (i, x), (2.2, 1.0, 0.1), (x, y + 2, Hh - 0.05), frame, bevel=0.02))
                objs.append(box('lampglow%d_%d' % (i, x), (2.0, 0.8, 0.02), (x, y + 2, Hh - 0.11), white, bevel=0))
    # floor lane lines
    for x in (-3, 3):
        objs.append(box('lane%d' % x, (0.06, L - 4, 0.01), (x, 0, 0.006), cyan, bevel=0))
    # far wall: blast door + two spawn portals
    yF = L / 2 - 0.05
    objs.append(box('doorframe', (6.4, 0.6, 5.4), (0, yF - 0.2, 2.7), frame, bevel=0.08))
    objs.append(box('door', (5.6, 0.2, 4.8), (0, yF - 0.55, 2.4), steel, bevel=0.03))
    for k in range(6):
        objs.append(box('doorstripe%d' % k, (0.5, 0.05, 0.12), (-2.0 + k * 0.8, yF - 0.68, 0.4), orange, bevel=0, rot=(0, 30, 0)))
    objs.append(box('doorglow', (5.6, 0.05, 0.06), (0, yF - 0.68, 4.85), red, bevel=0))
    for s in (1, -1):
        px = s * 5.8
        objs.append(cyl('padbase%d' % s, 1.5, 0.2, (px, yF - 3, 0.1), frame, verts=32, bevel=0.03))
        objs.append(torus('padring%d' % s, 1.35, 0.05, (px, yF - 3, 0.21), red, maj=40))
        objs.append(torus('portal%d' % s, 1.25, 0.12, (px, yF - 3, 1.6), frame, rot=(90, 0, 0), maj=40, mino=10))
        objs.append(torus('portalglow%d' % s, 1.12, 0.035, (px, yF - 3.12, 1.6), red, rot=(90, 0, 0), maj=40, mino=6))
        for a in range(6):
            ang = math.radians(a * 60 + 30)
            objs.append(box('portalclamp%d_%d' % (s, a), (0.18, 0.36, 0.3),
                            (px + math.cos(ang) * 1.3, yF - 3, 1.6 + math.sin(ang) * 1.3), steel, bevel=0.03,
                            rot=(0, -math.degrees(ang), 0)))
    # EXIT sign over the near wall (player side) and a big number display
    objs.append(box('exitsign', (1.4, 0.12, 0.45), (5.5, -L / 2 + 0.2, 4.0), frame, bevel=0.02))
    objs.append(box('exitglow', (1.2, 0.02, 0.3), (5.5, -L / 2 + 0.27, 4.0), orange, bevel=0))
    # cover: crates & consoles scattered along the sides (keep the centre lane clear)
    spots = [(-6.5, -8), (6.8, -4), (-7.0, 3), (6.5, 9), (-6.2, 12), (7.0, -12), (-7.2, -14)]
    for j, (x, y) in enumerate(spots):
        sz = 1.0 + 0.2 * (j % 2)
        objs.append(box('crate%d' % j, (sz, sz, sz), (x, y, sz / 2), crate_m, bevel=0.05, rot=(0, 0, j * 17)))
        objs.append(box('crateglow%d' % j, (sz * 0.8, 0.02, 0.04), (x, y - sz / 2 - 0.01, sz * 0.75), cyan if j % 2 else green,
                        bevel=0, rot=(0, 0, j * 17)))
        if j % 2 == 0:
            objs.append(box('crateB%d' % j, (0.8, 0.8, 0.8), (x + 0.3, y + 0.2, sz + 0.4), crate_m, bevel=0.04, rot=(0, 0, j * 31)))
    for j, (x, y) in enumerate([(-7.6, -1), (7.6, 5), (-7.6, 8)]):
        s = 1 if x > 0 else -1
        objs.append(box('console%d' % j, (0.9, 1.6, 1.1), (x, y, 0.55), frame, bevel=0.05))
        objs.append(box('consoletop%d' % j, (0.7, 1.4, 0.05), (x - s * 0.15, y, 1.12), console_scr, bevel=0, rot=(0, s * 25, 0)))
    # energy tubes (like the reference's glowing cylinders)
    for j, (x, y) in enumerate([(-7.5, -16), (7.5, -16), (-7.5, 16), (7.5, 16)]):
        objs.append(cyl('tubebase%d' % j, 0.6, 0.4, (x, y, 0.2), frame, verts=20, bevel=0.03))
        objs.append(cyl('tube%d' % j, 0.42, 2.6, (x, y, 1.7), cyan, verts=20))
        objs.append(cyl('tubecap%d' % j, 0.6, 0.4, (x, y, 3.2), frame, verts=20, bevel=0.03))
    # merge per material to keep draw calls low
    by_mat = {}
    for o in objs:
        key = o.data.materials[0].name if o.data.materials else 'none'
        by_mat.setdefault(key, []).append(o)
    merged = [join(v, 'Arena_' + k) for k, v in by_mat.items()]
    print('[arena] tris=%d meshes=%d' % (tri_count(merged), len(merged)))
    export_glb(os.path.join(OUT, 'arena.glb'))
    print('[arena] size=%d' % os.path.getsize(os.path.join(OUT, 'arena.glb')))
    if PREVIEW:
        sc = bpy.context.scene
        sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
        sc.render.resolution_x, sc.render.resolution_y = 960, 540
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
        cam.data.lens = 18
        cam.location = (0, -L / 2 + 3, 1.6)
        cam.rotation_euler = (math.radians(88), 0, 0)
        sc.render.filepath = os.path.join(OUT, 'arena_preview.png')
        bpy.ops.render.render(write_still=True)


blaster()
arena()
