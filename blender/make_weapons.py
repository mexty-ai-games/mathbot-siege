"""blender --background --factory-startup --python make_weapons.py -- <outdir> [preview]
Builds weapons.glb: WPN_pistol, WPN_rifle, WPN_shotgun, WPN_sniper (barrel along +Y, grip at the origin),
each with a MUZZLE_<id> empty at the barrel tip and gloved hands holding it."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, math
from mathutils import Vector
from lib import *

args = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(args[0])
PREVIEW = 'preview' in args
os.makedirs(OUT, exist_ok=True)


def mats():
    return dict(
        shell=mat('WShell', (0.42, 0.44, 0.48), metal=0.55, rough=0.3),
        dark=mat('WDark', (0.025, 0.028, 0.034), metal=0.8, rough=0.38),
        metal=mat('WMetal', (0.22, 0.23, 0.25), metal=0.95, rough=0.22),
        glow=mat('WGlow', (0.2, 0.9, 1), metal=0, rough=0.3, emit=(0.15, 0.85, 1.0), strength=7),
        lens=mat('WLens', (0.05, 0.2, 0.3), metal=0.2, rough=0.05, emit=(0.1, 0.5, 0.9), strength=2),
        glove=mat('Glove', (0.16, 0.16, 0.15), metal=0.0, rough=0.9),
        plate=mat('GlovePlate', (0.09, 0.1, 0.12), metal=0.7, rough=0.4),
    )


def accent(name, rgb):
    return mat('WAccent_' + name, rgb, metal=0.5, rough=0.32)


def limb(name, a, b, r, m, r2=None):
    """Cylinder from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = cyl(name, r, d.length, (a + b) / 2, m, verts=14, r2=r2)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def hands(M, parts, support=None):
    """Right hand on the grip (origin); optional left hand at `support` (y, z) under the barrel."""
    parts.append(box('hand', (0.072, 0.08, 0.068), (0.0, -0.035, -0.02), M['glove'], bevel=0.024, rot=(-16, 0, 0)))
    parts.append(box('knuckles', (0.064, 0.03, 0.055), (0.0, 0.012, -0.045), M['glove'], bevel=0.012))
    parts.append(box('thumb', (0.022, 0.055, 0.022), (0.033, 0.0, 0.02), M['glove'], bevel=0.008))
    parts.append(limb('wrist', (0.0, -0.05, -0.04), (0.01, -0.15, -0.085), 0.042, M['glove']))
    parts.append(limb('sleeve', (0.01, -0.13, -0.075), (0.04, -0.45, -0.22), 0.05, M['glove'], r2=0.062))
    parts.append(box('bracer', (0.085, 0.17, 0.03), (0.01, -0.24, -0.07), M['plate'], bevel=0.01, rot=(-22, 0, 0)))
    parts.append(box('bracerglow', (0.035, 0.11, 0.004), (0.01, -0.24, -0.052), M['glow'], bevel=0, rot=(-22, 0, 0)))
    if support:
        y, z = support
        parts.append(box('lhand', (0.07, 0.085, 0.06), (-0.005, y, z - 0.045), M['glove'], bevel=0.022))
        parts.append(box('lfingers', (0.02, 0.07, 0.05), (0.035, y, z - 0.01), M['glove'], bevel=0.008))
        parts.append(limb('lwrist', (-0.01, y - 0.02, z - 0.06), (-0.07, y - 0.12, z - 0.12), 0.04, M['glove']))
        parts.append(limb('lsleeve', (-0.06, y - 0.1, z - 0.11), (-0.3, y - 0.5, z - 0.3), 0.05, M['glove'], r2=0.064))
        parts.append(box('lbracer', (0.07, 0.14, 0.028), (-0.13, y - 0.24, z - 0.17), M['plate'], bevel=0.01, rot=(-25, 0, -30)))


def grip(M, parts, color):
    parts.append(profile('grip', [(-0.035, 0.03), (0.018, 0.03), (-0.004, -0.095), (-0.06, -0.1), (-0.07, -0.085)], 0.036, M['dark']))
    parts.append(profile('gripplate', [(-0.03, 0.02), (0.008, 0.02), (-0.01, -0.07), (-0.05, -0.075)], 0.04, color, bevel=0.003))
    parts.append(profile('guard', [(0.0, 0.03), (0.08, 0.03), (0.08, -0.005), (0.07, -0.012), (0.012, -0.012), (0.012, 0.0), (0.06, 0.0), (0.066, 0.02), (0.0, 0.02)], 0.012, M['dark'], bevel=0.002))
    parts.append(box('trigger', (0.008, 0.008, 0.026), (0.0, 0.035, 0.008), M['metal'], bevel=0.002, rot=(-15, 0, 0)))


def finish_weapon(name, parts, muzzle):
    o = join(parts, 'WPN_' + name)
    e = bpy.data.objects.new('MUZZLE_' + name, None)
    bpy.context.collection.objects.link(e)
    e.location = muzzle
    e.parent = o
    print('[%s] tris=%d' % (name, tri_count([o])))
    return o


def pistol(M):
    A = accent('pistol', (0.05, 0.3, 0.95))
    p = []
    p.append(profile('slide', [(-0.07, 0.07), (-0.06, 0.105), (0.17, 0.105), (0.195, 0.088), (0.195, 0.048), (-0.055, 0.048)], 0.044, M['shell']))
    p.append(profile('frame', [(-0.05, 0.05), (0.17, 0.05), (0.17, 0.03), (0.04, 0.03), (0.02, 0.022), (-0.04, 0.025)], 0.04, M['dark']))
    for i in range(5):
        p.append(box('serr%d' % i, (0.046, 0.004, 0.03), (0, -0.04 + i * 0.01, 0.078), M['dark'], bevel=0))
    p.append(box('sidepanel_l', (0.004, 0.13, 0.022), (0.023, 0.07, 0.075), A, bevel=0.002))
    p.append(box('sidepanel_r', (0.004, 0.13, 0.022), (-0.023, 0.07, 0.075), A, bevel=0.002))
    p.append(box('glowline_l', (0.003, 0.12, 0.004), (0.025, 0.07, 0.062), M['glow'], bevel=0))
    p.append(box('glowline_r', (0.003, 0.12, 0.004), (-0.025, 0.07, 0.062), M['glow'], bevel=0))
    p.append(cyl('barrel', 0.012, 0.06, (0, 0.215, 0.072), M['metal'], rot=(90, 0, 0), verts=14))
    p.append(cyl('coil', 0.019, 0.02, (0, 0.2, 0.072), M['glow'], rot=(90, 0, 0), verts=16))
    p.append(cyl('muzzle', 0.016, 0.012, (0, 0.247, 0.072), M['dark'], rot=(90, 0, 0), verts=14, bevel=0.002))
    p.append(box('rearsight', (0.03, 0.01, 0.012), (0, -0.05, 0.112), M['dark'], bevel=0.002))
    p.append(box('frontsight', (0.006, 0.01, 0.01), (0, 0.18, 0.11), M['glow'], bevel=0))
    p.append(box('rail', (0.03, 0.08, 0.008), (0, 0.12, 0.026), M['dark'], bevel=0.002))
    grip(M, p, A)
    hands(M, p)
    return finish_weapon('pistol', p, (0, 0.26, 0.072))


def rifle(M):
    A = accent('rifle', (0.95, 0.35, 0.06))
    p = []
    p.append(profile('receiver', [(-0.14, 0.05), (-0.14, 0.105), (0.25, 0.115), (0.29, 0.1), (0.29, 0.045), (0.02, 0.035)], 0.052, M['shell']))
    p.append(profile('stock', [(-0.14, 0.1), (-0.14, 0.05), (-0.31, 0.015), (-0.36, 0.015), (-0.36, 0.11), (-0.3, 0.115)], 0.04, M['dark']))
    p.append(box('stockpad', (0.044, 0.02, 0.1), (0, -0.365, 0.063), M['glove'], bevel=0.006))
    p.append(box('stockglow', (0.042, 0.12, 0.004), (0, -0.25, 0.1), M['glow'], bevel=0))
    p.append(profile('handguard', [(0.25, 0.1), (0.5, 0.098), (0.52, 0.085), (0.52, 0.04), (0.25, 0.042)], 0.058, M['dark']))
    for i in range(6):
        p.append(box('vent%d' % i, (0.06, 0.018, 0.006), (0, 0.29 + i * 0.035, 0.07), M['glow'], bevel=0))
    p.append(cyl('barrel', 0.013, 0.14, (0, 0.58, 0.07), M['metal'], rot=(90, 0, 0), verts=14))
    p.append(cyl('brake', 0.02, 0.05, (0, 0.65, 0.07), M['dark'], rot=(90, 0, 0), verts=8, bevel=0.003))
    p.append(box('rail', (0.026, 0.34, 0.012), (0, 0.17, 0.122), M['dark'], bevel=0.002))
    # holo sight
    p.append(box('holobase', (0.04, 0.06, 0.014), (0, 0.05, 0.135), M['dark'], bevel=0.003))
    p.append(profile('holohood', [(0.025, 0.14), (0.075, 0.14), (0.075, 0.2), (0.04, 0.2)], 0.046, A, x=0, bevel=0.004))
    p.append(box('hololens', (0.034, 0.002, 0.04), (0, 0.06, 0.168), M['lens'], bevel=0))
    p.append(profile('mag', [(0.06, 0.04), (0.12, 0.04), (0.14, -0.08), (0.1, -0.13), (0.07, -0.12), (0.085, -0.06)], 0.034, A))
    p.append(box('magglow', (0.036, 0.02, 0.005), (0, 0.095, 0.0), M['glow'], bevel=0))
    p.append(box('sidepanel', (0.056, 0.18, 0.018), (0, 0.07, 0.08), A, bevel=0.003))
    grip(M, p, A)
    hands(M, p, support=(0.4, 0.04))
    return finish_weapon('rifle', p, (0, 0.68, 0.07))


def shotgun(M):
    A = accent('shotgun', (0.85, 0.1, 0.25))
    p = []
    p.append(profile('receiver', [(-0.12, 0.05), (-0.12, 0.12), (0.2, 0.125), (0.22, 0.11), (0.22, 0.03), (0.02, 0.025)], 0.07, M['shell']))
    p.append(profile('stock', [(-0.12, 0.11), (-0.12, 0.05), (-0.28, 0.02), (-0.3, 0.03), (-0.3, 0.1), (-0.25, 0.115)], 0.05, M['dark']))
    for i, z in enumerate((0.1, 0.06)):
        p.append(cyl('barrel%d' % i, 0.02, 0.32, (0, 0.37, z), M['metal'], rot=(90, 0, 0), verts=16))
        p.append(cyl('bore%d' % i, 0.024, 0.03, (0, 0.53, z), M['dark'], rot=(90, 0, 0), verts=16, bevel=0.003))
        p.append(cyl('boreglow%d' % i, 0.014, 0.004, (0, 0.547, z), M['glow'], rot=(90, 0, 0), verts=16))
    p.append(box('barrelstrap', (0.05, 0.02, 0.09), (0, 0.48, 0.08), A, bevel=0.004))
    p.append(profile('pump', [(0.26, 0.045), (0.42, 0.045), (0.42, 0.0), (0.4, -0.012), (0.28, -0.012), (0.26, 0.0)], 0.07, M['dark']))
    for i in range(4):
        p.append(box('pumprib%d' % i, (0.074, 0.008, 0.05), (0, 0.29 + i * 0.035, 0.018), A, bevel=0.002))
    p.append(cyl('drum', 0.068, 0.06, (0, 0.11, -0.005), M['dark'], rot=(0, 90, 0), verts=24, bevel=0.006))
    p.append(torus('drumring', 0.064, 0.006, (0.031, 0.11, -0.005), M['glow'], rot=(0, 90, 0), maj=28, mino=6))
    p.append(torus('drumring2', 0.064, 0.006, (-0.031, 0.11, -0.005), M['glow'], rot=(0, 90, 0), maj=28, mino=6))
    p.append(box('sidepanel', (0.074, 0.16, 0.026), (0, 0.06, 0.09), A, bevel=0.004))
    p.append(box('bead', (0.008, 0.01, 0.01), (0, 0.5, 0.125), M['glow'], bevel=0))
    grip(M, p, A)
    hands(M, p, support=(0.34, 0.0))
    return finish_weapon('shotgun', p, (0, 0.56, 0.08))


def sniper(M):
    A = accent('sniper', (0.3, 0.9, 0.35))
    p = []
    p.append(profile('receiver', [(-0.12, 0.05), (-0.12, 0.1), (0.22, 0.1), (0.24, 0.085), (0.24, 0.045), (0.02, 0.035)], 0.05, M['shell']))
    p.append(profile('stock', [(-0.12, 0.095), (-0.12, 0.05), (-0.22, 0.03), (-0.42, 0.02), (-0.44, 0.03), (-0.44, 0.115), (-0.3, 0.12), (-0.24, 0.135), (-0.17, 0.12)], 0.042, M['dark']))
    p.append(box('cheek', (0.046, 0.12, 0.02), (0, -0.28, 0.13), A, bevel=0.006))
    p.append(profile('handguard', [(0.24, 0.092), (0.55, 0.088), (0.56, 0.075), (0.56, 0.045), (0.24, 0.045)], 0.05, M['dark']))
    p.append(cyl('barrel', 0.012, 0.36, (0, 0.73, 0.068), M['metal'], rot=(90, 0, 0), verts=14))
    for i in range(4):
        p.append(cyl('flute%d' % i, 0.015, 0.012, (0, 0.6 + i * 0.05, 0.068), M['glow'], rot=(90, 0, 0), verts=14))
    p.append(cyl('suppressor', 0.022, 0.12, (0, 0.95, 0.068), M['dark'], rot=(90, 0, 0), verts=16, bevel=0.004))
    # scope
    p.append(cyl('scope', 0.026, 0.27, (0, 0.06, 0.155), M['dark'], rot=(90, 0, 0), verts=20, bevel=0.003))
    p.append(cyl('scopefront', 0.036, 0.07, (0, 0.21, 0.155), M['dark'], rot=(90, 0, 0), verts=20, r2=0.027))
    p.append(cyl('scopeback', 0.032, 0.05, (0, -0.1, 0.155), M['dark'], rot=(90, 0, 0), verts=20))
    p.append(cyl('lensfront', 0.03, 0.004, (0, 0.247, 0.155), M['lens'], rot=(90, 0, 0), verts=20))
    p.append(cyl('lensback', 0.027, 0.004, (0, -0.127, 0.155), M['lens'], rot=(90, 0, 0), verts=20))
    p.append(cyl('turret', 0.014, 0.03, (0, 0.05, 0.19), A, verts=12, bevel=0.002))
    p.append(cyl('turret2', 0.014, 0.03, (0.035, 0.05, 0.155), A, rot=(0, 90, 0), verts=12, bevel=0.002))
    for y in (-0.03, 0.13):
        p.append(box('mount%d' % int(y * 100), (0.03, 0.025, 0.05), (0, y, 0.115), M['metal'], bevel=0.003))
    p.append(box('scopeglow', (0.004, 0.18, 0.004), (0.026, 0.06, 0.155), M['glow'], bevel=0))
    p.append(cyl('bolt', 0.008, 0.06, (0.045, -0.02, 0.085), M['metal'], rot=(0, 90, 0), verts=10))
    p.append(sphere('boltknob', 0.013, (0.078, -0.02, 0.085), M['dark'], seg=10, rings=6))
    p.append(profile('mag', [(0.07, 0.04), (0.13, 0.04), (0.13, -0.04), (0.07, -0.04)], 0.036, A, bevel=0.004))
    for s in (1, -1):
        p.append(box('bipod%d' % s, (0.01, 0.2, 0.012), (s * 0.018, 0.42, 0.03), M['metal'], bevel=0.002, rot=(0, 0, s * 4)))
    grip(M, p, A)
    hands(M, p, support=(0.36, 0.045))
    return finish_weapon('sniper', p, (0, 1.02, 0.068))


reset()
M = mats()
weapons = [pistol(M), rifle(M), shotgun(M), sniper(M)]
export_glb(os.path.join(OUT, 'weapons.glb'))
print('[weapons] size=%d' % os.path.getsize(os.path.join(OUT, 'weapons.glb')))

if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x, sc.render.resolution_y = 640, 360
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO'
    for w in weapons:
        for o in weapons:
            o.hide_render = o is not w
        name = w.name[4:]
        span = 1.7 if name == 'sniper' else 1.25
        cam.data.ortho_scale = span
        for view, loc in (('side', (2.0, 0.22, 0.03)), ('fp', (0.35, -0.75, 0.45))):
            cam.location = loc
            tgt = Vector((0, 0.22 if view == 'side' else 0.25, 0.03))
            cam.rotation_euler = (tgt - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
            cam.data.type = 'ORTHO' if view == 'side' else 'PERSP'
            sc.render.filepath = os.path.join(OUT, 'preview', 'weapon_%s_%s.png' % (name, view))
            bpy.ops.render.render(write_still=True)
