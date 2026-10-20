"""blender --background --factory-startup --python make_arena.py -- <outdir> [preview]
The Foundry: a 40 x 90 m orbital hangar with cover, catwalks, space windows and seven spawn portals.
Exports arena2.glb with an ARENA_META empty whose `meta` extra holds the layout as JSON (three.js coords):
bounds, player start, spawns, obstacle boxes, practical lights and light shafts."""
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import numpy as np
from lib import *
from make_world import floor_textures, wall_textures, noise

args = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(args[0])
PREVIEW = 'preview' in args
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(11)

W, L, H = 40.0, 90.0, 12.0
HX, HY = W / 2, L / 2


def t3(x, y):
    """Blender (x, y) -> three.js (x, z)."""
    return [round(x, 3), round(-y, 3)]


def space_texture(Wt=1024, Ht=512):
    """Starfield + nebula + a ringed planet, used as an emissive backdrop behind the windows."""
    img = np.zeros((Ht, Wt, 4), np.float32)
    img[..., 3] = 1
    yy, xx = np.mgrid[0:Ht, 0:Wt]
    neb = noise(Ht, Wt, 128) * 0.6 + noise(Ht, Wt, 48) * 0.4
    img[..., 0] = 0.02 + 0.10 * neb ** 3
    img[..., 1] = 0.02 + 0.05 * neb ** 3
    img[..., 2] = 0.05 + 0.18 * neb ** 2
    stars = rng.random((Ht, Wt)) > 0.9965
    b = rng.random((Ht, Wt))
    for c in range(3):
        img[..., c] = np.where(stars, 0.6 + 0.4 * b, img[..., c])
    cx, cy, r = Wt * 0.72, Ht * 1.05, Ht * 0.62
    d = np.hypot(xx - cx, yy - cy)
    planet = d < r
    shade = np.clip(1 - (d / r) ** 3, 0, 1) * np.clip((cx - xx + r * 0.6) / (r * 1.6), 0.15, 1)
    bands = 0.5 + 0.5 * np.sin(yy * 0.09 + noise(Ht, Wt, 32) * 2)
    img[..., 0] = np.where(planet, 0.12 + 0.25 * shade * bands, img[..., 0])
    img[..., 1] = np.where(planet, 0.2 + 0.35 * shade, img[..., 1])
    img[..., 2] = np.where(planet, 0.35 + 0.5 * shade, img[..., 2])
    rim = (d > r) & (d < r + 6)
    img[..., 0] = np.where(rim, 0.4, img[..., 0])
    img[..., 1] = np.where(rim, 0.8, img[..., 1])
    img[..., 2] = np.where(rim, 1.0, img[..., 2])
    return image_from_array('space', img)


def build():
    reset()
    fb, fe = floor_textures()
    wb, we = wall_textures()
    sp = space_texture()
    m_floor = tex_mat('Floor', fb, fe, emit_strength=0.6, metal=0.7, rough=0.35)
    m_wall = tex_mat('Wall', wb, we, emit_strength=2.5, metal=0.6, rough=0.5)
    m_space = tex_mat('Space', sp, sp, emit_strength=1.4, metal=0, rough=1)
    frame = mat('ArenaFrame', (0.05, 0.055, 0.065), metal=0.85, rough=0.35)
    steel = mat('ArenaSteel', (0.25, 0.27, 0.3), metal=0.9, rough=0.3)
    cyan = mat('NeonCyan', (0.1, 0.9, 1), metal=0, rough=0.4, emit=(0.1, 0.85, 1.0), strength=10)
    green = mat('NeonGreen', (0.2, 1, 0.4), metal=0, rough=0.4, emit=(0.15, 1.0, 0.35), strength=8)
    white = mat('NeonWhite', (1, 1, 1), metal=0, rough=0.4, emit=(0.75, 0.9, 1.0), strength=6)
    red = mat('NeonRed', (1, 0.1, 0.1), metal=0, rough=0.4, emit=(1.0, 0.08, 0.06), strength=10)
    orange = mat('NeonOrange', (1, 0.5, 0.1), metal=0, rough=0.4, emit=(1.0, 0.45, 0.05), strength=8)
    cont = [mat('ContOrange', (0.55, 0.2, 0.04), metal=0.6, rough=0.5), mat('ContTeal', (0.03, 0.3, 0.32), metal=0.6, rough=0.5),
            mat('ContRed', (0.45, 0.04, 0.05), metal=0.6, rough=0.5), mat('ContGrey', (0.2, 0.22, 0.25), metal=0.6, rough=0.5)]
    crate_m = mat('Crate', (0.18, 0.2, 0.24), metal=0.7, rough=0.45)
    hazard = mat('Hazard', (0.9, 0.6, 0.05), metal=0.2, rough=0.6)
    objs = []
    obstacles = []   # three.js AABBs [cx, cz, halfX, halfZ]

    def ob(x, y, sx, sy):
        c = t3(x, y)
        obstacles.append([c[0], c[1], round(sx / 2, 3), round(sy / 2, 3)])

    # ---------------- shell: floor, walls with window bands, ceiling
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    fl = bpy.context.active_object; fl.name = 'Floor'; fl.scale = (W, L, 1)
    bpy.ops.object.transform_apply(scale=True)
    fl.data.materials.append(m_floor); world_uv(fl, 4.0); objs.append(fl)
    WIN0, WIN1 = 6.0, 10.0   # window band height
    for nm, size, locx, locy in [('L', (0.5, L), HX + 0.25, 0), ('R', (0.5, L), -HX - 0.25, 0),
                                 ('F', (W, 0.5), 0, HY + 0.25), ('N', (W, 0.5), 0, -HY - 0.25)]:
        if nm == 'N':
            o = box('Wall' + nm, (size[0], size[1], H), (locx, locy, H / 2), m_wall, bevel=0); world_uv(o, 3.5); objs.append(o)
            continue
        lo = box('WallLo' + nm, (size[0], size[1], WIN0), (locx, locy, WIN0 / 2), m_wall, bevel=0); world_uv(lo, 3.5); objs.append(lo)
        hi = box('WallHi' + nm, (size[0], size[1], H - WIN1), (locx, locy, (H + WIN1) / 2), m_wall, bevel=0); world_uv(hi, 3.5); objs.append(hi)
        # mullions every 5 m and the space backdrop outside
        along = L if nm in 'LR' else W
        n = int(along // 5)
        for i in range(n + 1):
            t = -along / 2 + i * along / n
            if nm in 'LR':
                objs.append(box('mull%s%d' % (nm, i), (0.6, 0.35, WIN1 - WIN0), (locx, t, (WIN0 + WIN1) / 2), frame, bevel=0.03))
            else:
                objs.append(box('mull%s%d' % (nm, i), (0.35, 0.6, WIN1 - WIN0), (t, locy, (WIN0 + WIN1) / 2), frame, bevel=0.03))
        if nm in 'LR':
            objs.append(box('winsill' + nm, (0.9, L, 0.25), (locx - math.copysign(0.2, locx), 0, WIN0), steel, bevel=0.03))
            objs.append(box('winglow' + nm, (0.05, L, 0.06), (locx - math.copysign(0.66, locx), 0, WIN0 + 0.15), cyan, bevel=0))
            bpy.ops.mesh.primitive_plane_add(size=1, location=(locx + math.copysign(14, locx), 0, (WIN0 + WIN1) / 2 + 2),
                                             rotation=(math.radians(90), 0, math.radians(90)))
            pl = bpy.context.active_object; pl.name = 'space' + nm; pl.scale = (L * 1.3, 22, 1)
        else:
            objs.append(box('winsill' + nm, (W, 0.9, 0.25), (0, locy - 0.2, WIN0), steel, bevel=0.03))
            objs.append(box('winglow' + nm, (W, 0.05, 0.06), (0, locy - 0.66, WIN0 + 0.15), cyan, bevel=0))
            bpy.ops.mesh.primitive_plane_add(size=1, location=(0, locy + 14, (WIN0 + WIN1) / 2 + 2), rotation=(math.radians(90), 0, 0))
            pl = bpy.context.active_object; pl.name = 'space' + nm; pl.scale = (W * 2.2, 22, 1)
        bpy.ops.object.transform_apply(scale=True)
        pl.data.materials.append(m_space); objs.append(pl)
    ceil = box('Ceiling', (W, L, 0.4), (0, 0, H + 0.2), frame, bevel=0); objs.append(ceil)

    # ---------------- ceiling trusses + lamps + skylight strips
    shafts = []
    for i in range(16):
        y = -HY + 3 + i * 6
        objs.append(box('truss%d' % i, (W, 0.5, 0.9), (0, y, H - 0.45), frame, bevel=0.04))
        objs.append(box('trussglow%d' % i, (W - 2, 0.05, 0.05), (0, y - 0.27, H - 0.8), cyan, bevel=0))
        if i % 2 == 0:
            for x in (-10, 0, 10):
                objs.append(box('lamp%d_%d' % (i, x), (3.2, 1.2, 0.12), (x, y + 3, H - 0.1), frame, bevel=0.02))
                objs.append(box('lampglow%d_%d' % (i, x), (3.0, 1.0, 0.03), (x, y + 3, H - 0.18), white, bevel=0))
                if x != 0 and i % 4 == 0:
                    shafts.append(t3(x, y + 3))

    # ---------------- catwalks along both side walls
    CW = 5.0
    for s in (1, -1):
        x = s * (HX - 1.4)
        objs.append(box('catwalk%d' % s, (2.6, L - 1, 0.25), (x, 0, CW), steel, bevel=0.03))
        objs.append(box('catglow%d' % s, (0.05, L - 1, 0.05), (x - s * 1.32, 0, CW - 0.12), green, bevel=0))
        objs.append(box('rail%d' % s, (0.07, L - 1, 0.07), (x - s * 1.25, 0, CW + 1.0), steel, bevel=0))
        objs.append(box('railmid%d' % s, (0.05, L - 1, 0.05), (x - s * 1.25, 0, CW + 0.55), steel, bevel=0))
        for i in range(23):
            y = -HY + 2 + i * 4
            objs.append(box('post%d_%d' % (s, i), (0.08, 0.08, 1.05), (x - s * 1.25, y, CW + 0.5), steel, bevel=0))
            if i % 2 == 0:
                objs.append(box('bracket%d_%d' % (s, i), (2.4, 0.2, 0.2), (x + s * 0.05, y, CW - 0.6), frame, bevel=0.02, rot=(0, s * 25, 0)))

    # ---------------- structural pillars (cover)
    for x in (-10, 10):
        for y in (-26, -10, 6, 22, 36):
            objs.append(box('pillar%d_%d' % (x, y), (1.6, 1.6, H), (x, y, H / 2), frame, bevel=0.06))
            objs.append(box('pillarglow%d_%d' % (x, y), (1.66, 1.66, 0.08), (x, y, 2.5), cyan, bevel=0))
            objs.append(box('pillarbase%d_%d' % (x, y), (2.0, 2.0, 0.5), (x, y, 0.25), steel, bevel=0.05))
            ob(x, y, 2.0, 2.0)

    # ---------------- shipping containers (big cover)
    def container(i, x, y, along_y, col):
        lx, ly = (2.5, 6.0) if along_y else (6.0, 2.5)
        hz = 2.7
        objs.append(box('cont%d' % i, (lx, ly, hz), (x, y, hz / 2), cont[col], bevel=0.04))
        n = 14
        for k in range(n):
            t = -0.5 + (k + 0.5) / n
            if along_y:
                for s in (1, -1):
                    objs.append(box('rib%d_%d_%d' % (i, k, s), (0.06, 0.16, hz - 0.3), (x + s * lx / 2, y + t * ly, hz / 2), cont[col], bevel=0))
            else:
                for s in (1, -1):
                    objs.append(box('rib%d_%d_%d' % (i, k, s), (0.16, 0.06, hz - 0.3), (x + t * lx, y + s * ly / 2, hz / 2), cont[col], bevel=0))
        objs.append(box('contframe%d' % i, (lx + 0.12, ly + 0.12, 0.14), (x, y, hz - 0.05), frame, bevel=0.02))
        objs.append(box('contframeb%d' % i, (lx + 0.12, ly + 0.12, 0.14), (x, y, 0.07), frame, bevel=0.02))
        if along_y:
            objs.append(box('contglow%d' % i, (lx + 0.14, 0.06, 0.1), (x, y - ly / 2, hz * 0.7), orange if col == 0 else cyan, bevel=0))
        else:
            objs.append(box('contglow%d' % i, (0.06, ly + 0.14, 0.1), (x - lx / 2, y, hz * 0.7), orange if col == 0 else cyan, bevel=0))
        ob(x, y, lx, ly)

    for i, (x, y, ay, c) in enumerate([(-5, -22, False, 0), (6, -14, False, 1), (-13, -2, True, 2), (2, 2, False, 3),
                                       (13, 14, True, 0), (-5, 20, False, 1), (8, 30, False, 2), (-14, 30, True, 3)]):
        container(i, x, y, ay, c)
    # stacked one on top (decor, same footprint)
    objs.append(box('contstack', (6.0, 2.5, 2.7), (-5, -22, 4.05), cont[3], bevel=0.04))

    # ---------------- crate stacks and barriers (small cover)
    for j, (x, y) in enumerate([(3, -30), (-9, -32), (15, -28), (-16, 10), (16, 4), (-2, 36), (5, 12), (-3, -8)]):
        sz = 1.4
        objs.append(box('crate%d' % j, (sz, sz, sz), (x, y, sz / 2), crate_m, bevel=0.06, rot=(0, 0, (j * 23) % 40 - 20)))
        objs.append(box('crateglow%d' % j, (sz * 0.8, 0.02, 0.05), (x, y - sz / 2 - 0.02, sz * 0.75), green if j % 2 else cyan, bevel=0))
        if j % 2 == 0:
            objs.append(box('crateB%d' % j, (1.0, 1.0, 1.0), (x + 0.2, y + 0.1, sz + 0.5), crate_m, bevel=0.05, rot=(0, 0, j * 31)))
        ob(x, y, sz + 0.3, sz + 0.3)
    for j, (x, y) in enumerate([(9, -2), (-9, 14), (3, 24), (-1, -16)]):
        objs.append(box('barrier%d' % j, (4.0, 0.7, 1.0), (x, y, 0.5), steel, bevel=0.08))
        for k in range(5):
            objs.append(box('barstripe%d_%d' % (j, k), (0.35, 0.72, 0.18), (x - 1.6 + k * 0.8, y, 0.75), hazard, bevel=0, rot=(0, 30, 0)))
        ob(x, y, 4.0, 0.9)

    # ---------------- spawn portals: far wall (3), side walls (4)
    spawns = []

    def portal(name, x, y, face_deg, col):
        """Ring on the floor + upright ring facing into the hall. face_deg: direction robots walk out (Blender Z rot)."""
        rz = math.radians(face_deg)
        fx, fy = -math.sin(rz), math.cos(rz)   # forward (into the hall)
        objs.append(cyl('padbase' + name, 1.7, 0.2, (x, y, 0.1), frame, verts=32, bevel=0.03))
        objs.append(torus('padring' + name, 1.5, 0.05, (x, y, 0.21), col, maj=40))
        bpy.ops.mesh.primitive_torus_add(major_radius=1.4, minor_radius=0.14, major_segments=40, minor_segments=10,
                                         location=(x - fx * 0.6, y - fy * 0.6, 1.8), rotation=(math.radians(90), 0, rz))
        o = bpy.context.active_object; o.name = 'portal' + name; o.data.materials.append(frame); objs.append(o)
        bpy.ops.mesh.primitive_torus_add(major_radius=1.26, minor_radius=0.04, major_segments=40, minor_segments=6,
                                         location=(x - fx * 0.48, y - fy * 0.48, 1.8), rotation=(math.radians(90), 0, rz))
        o = bpy.context.active_object; o.name = 'portalglow' + name; o.data.materials.append(col); objs.append(o)
        for k in range(6):
            hx, hy = x + fx * (2.2 + k * 0.45) - fy * 1.6, y + fy * (2.2 + k * 0.45) + fx * 1.6
            objs.append(box('haz%s%d' % (name, k), (0.25, 0.25, 0.01), (hx, hy, 0.006), hazard, bevel=0))
            objs.append(box('hazb%s%d' % (name, k), (0.25, 0.25, 0.01), (hx + fy * 3.2, hy - fx * 3.2, 0.006), hazard, bevel=0))
        spawns.append(t3(x + fx * 0.6, y + fy * 0.6))

    portal('F1', -12, HY - 3.2, 180, red)
    portal('F2', 12, HY - 3.2, 180, red)
    portal('F3', 0, HY - 3.2, 180, orange)
    portal('L1', HX - 3.2, 14, 90, red)
    portal('L2', HX - 3.2, -4, 90, orange)
    portal('R1', -HX + 3.2, 14, -90, red)
    portal('R2', -HX + 3.2, -4, -90, orange)

    # big blast door decor behind the centre far portal
    objs.append(box('doorframe', (8.0, 0.8, 7.0), (0, HY - 0.3, 3.5), frame, bevel=0.1))
    objs.append(box('door', (7.0, 0.3, 6.2), (0, HY - 0.75, 3.1), steel, bevel=0.04))
    for k in range(8):
        objs.append(box('doorstripe%d' % k, (0.6, 0.06, 0.16), (-3.0 + k * 0.85, HY - 0.92, 0.5), hazard, bevel=0, rot=(0, 30, 0)))
    objs.append(box('doorglow', (7.0, 0.06, 0.08), (0, HY - 0.92, 6.3), red, bevel=0))

    # player start pad + EXIT sign on the near wall
    objs.append(cyl('startpad', 1.6, 0.06, (0, -HY + 7, 0.03), frame, verts=40))
    objs.append(torus('startring', 1.5, 0.04, (0, -HY + 7, 0.07), cyan, maj=48))
    objs.append(box('exitsign', (2.0, 0.15, 0.6), (8, -HY + 0.1, 4.0), frame, bevel=0.03))
    objs.append(box('exitglow', (1.8, 0.04, 0.4), (8, -HY + 0.18, 4.0), orange, bevel=0))

    # floor lane lines toward the player
    for x in (-4, 4):
        objs.append(box('lane%d' % x, (0.08, L - 20, 0.012), (x, -4, 0.006), cyan, bevel=0))
    # energy tubes in the corners
    for j, (x, y) in enumerate([(-17.5, -42), (17.5, -42), (-17.5, 41), (17.5, 41)]):
        objs.append(cyl('tubebase%d' % j, 0.8, 0.5, (x, y, 0.25), frame, verts=20, bevel=0.03))
        objs.append(cyl('tube%d' % j, 0.55, 3.4, (x, y, 2.2), cyan, verts=20))
        objs.append(cyl('tubecap%d' % j, 0.8, 0.5, (x, y, 4.15), frame, verts=20, bevel=0.03))
        ob(x, y, 1.6, 1.6)

    # ---------------- merge by material
    by_mat = {}
    for o in objs:
        key = o.data.materials[0].name if o.data.materials else 'none'
        by_mat.setdefault(key, []).append(o)
    merged = [join(v, 'Arena_' + k) for k, v in by_mat.items()]

    lights = []
    for s in spawns:
        lights.append([s[0], 1.8, s[1], 0xff2a20, 10])
    for z in (-30, -10, 10, 30):
        lights.append([0, 9.0, z, 0x40d8ff, 40])
    lights += [[-15, 6.5, -20, 0x40ff90, 18], [15, 6.5, 20, 0x40ff90, 18], [0, 3, -38, 0x60c0ff, 12]]

    meta = {
        'bounds': {'minX': -HX + 1.2, 'maxX': HX - 1.2, 'minZ': -HY + 1.2, 'maxZ': HY - 1.2},
        'player': t3(0, -HY + 7),
        'spawns': spawns,
        'obstacles': obstacles,
        'lights': lights,
        'shafts': shafts,
        'height': H,
    }
    e = bpy.data.objects.new('ARENA_META', None)
    bpy.context.collection.objects.link(e)
    e['meta'] = json.dumps(meta)
    print('[arena2] tris=%d meshes=%d spawns=%d obstacles=%d' % (tri_count(merged), len(merged), len(spawns), len(obstacles)))
    export_glb(os.path.join(OUT, 'arena2.glb'))
    print('[arena2] size=%d' % os.path.getsize(os.path.join(OUT, 'arena2.glb')))

    if PREVIEW:
        sc = bpy.context.scene
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'STUDIO'
        sc.display.shading.color_type = 'MATERIAL'
        sc.render.resolution_x, sc.render.resolution_y = 960, 540
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        sc.collection.objects.link(cam)
        sc.camera = cam
        for nm, loc, rot, lens in (('fp', (0, -HY + 7, 1.65), (88, 0, 0), 16), ('top', (0, 0, 80), (0, 0, 0), 30)):
            cam.location = loc
            cam.rotation_euler = [math.radians(a) for a in rot]
            cam.data.lens = lens
            ceil_objs = [o for o in bpy.data.objects if o.name in ('Arena_ArenaFrame',)]
            for o in ceil_objs:
                o.hide_render = nm == 'top'
            sc.render.filepath = os.path.join(OUT, 'preview', 'arena2_%s.png' % nm)
            bpy.ops.render.render(write_still=True)


build()
