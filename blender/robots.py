"""Robot builders: humanoid drone, heavy mech (bulk humanoid) and spider. Each gets a rig,
five animation clips and PANEL_* sockets where the game draws the answer screens."""
import math
from lib import *

# Material names matter: the game recolours "Armor" and "Glow" per robot type.
def robot_mats():
    return dict(
        armor=mat('Armor', (0.55, 0.05, 0.06), metal=0.75, rough=0.32),
        frame=mat('Frame', (0.035, 0.038, 0.045), metal=0.85, rough=0.38),
        joint=mat('Joint', (0.28, 0.29, 0.31), metal=0.95, rough=0.22),
        glow=mat('Glow', (1, 0.15, 0.1), metal=0, rough=0.4, emit=(1.0, 0.12, 0.08), strength=6),
        screen=mat('Screen', (0.01, 0.01, 0.012), metal=0.2, rough=0.12),
    )


def panel(rig, M, bone, name, center, w, h, depth=0.035, face=-1):
    """A dark bezel with an inset screen facing -Y, plus the socket for the digits."""
    x, y, z = center
    rig.add(bone, box(name + '_frame', (w + 0.04, depth, h + 0.04), (x, y, z), M['frame'], bevel=0.008))
    rig.add(bone, box(name + '_scr', (w, 0.01, h), (x, y - depth / 2, z), M['screen'], bevel=0.0))
    # tiny red status LEDs on the bezel
    rig.add(bone, box(name + '_led', (0.02, 0.008, 0.008), (x + w / 2 - 0.01, y - depth / 2 - 0.002, z + h / 2 + 0.012),
                      M['glow'], bevel=0))
    rig.socket('PANEL_' + name, bone, (x, y - depth / 2 - 0.007, z), w, h)


def humanoid(name, bulk=1.0, panels=('head', 'chest', 'armL', 'thighL', 'thighR'), cannons=False):
    M = robot_mats()
    k = bulk
    sx = lambda v: v * (1 + (k - 1) * 0.9)   # widths scale with bulk
    H = 1.0 + (k - 1) * 0.25                  # height scale (mech a bit taller)
    z = lambda v: v * H
    hipW, shW = sx(0.12), sx(0.31)
    bones = [
        ('root', (0, 0, 0), (0, 0, 0.2), None),
        ('hips', (0, 0, z(0.95)), (0, 0, z(1.12)), 'root'),
        ('spine', (0, 0, z(1.12)), (0, 0, z(1.32)), 'hips'),
        ('chest', (0, 0, z(1.32)), (0, 0, z(1.62)), 'spine'),
        ('head', (0, 0, z(1.66)), (0, 0, z(1.95)), 'chest'),
    ]
    for s, L in ((1, 'L'), (-1, 'R')):
        bones += [
            ('upper_arm.' + L, (s * shW, 0, z(1.55)), (s * (shW + 0.03), 0, z(1.24)), 'chest'),
            ('forearm.' + L, (s * (shW + 0.03), 0, z(1.24)), (s * (shW + 0.04), 0, z(0.96)), 'upper_arm.' + L),
            ('hand.' + L, (s * (shW + 0.04), 0, z(0.96)), (s * (shW + 0.04), 0, z(0.82)), 'forearm.' + L),
            ('thigh.' + L, (s * hipW, 0, z(0.95)), (s * (hipW + 0.01), 0, z(0.53)), 'hips'),
            ('shin.' + L, (s * (hipW + 0.01), 0, z(0.53)), (s * (hipW + 0.01), 0, z(0.10)), 'thigh.' + L),
            ('foot.' + L, (s * (hipW + 0.01), 0, z(0.10)), (s * (hipW + 0.01), -0.14, z(0.03)), 'shin.' + L),
        ]
    arm = make_armature(name + '_rig', bones)
    R = Rig(arm)

    # --- pelvis
    R.add('hips', box('pelvis', (sx(0.36), sx(0.24), z(0.17)), (0, 0, z(1.0)), M['armor'], bevel=0.03))
    R.add('hips', box('belt', (sx(0.38), sx(0.26), 0.05), (0, 0, z(1.08)), M['frame']))
    R.add('hips', box('codplate', (sx(0.14), 0.04, z(0.12)), (0, -sx(0.13), z(0.97)), M['frame'], bevel=0.01))
    # --- abdomen
    R.add('spine', cyl('abs', sx(0.12), z(0.22), (0, 0, z(1.22)), M['joint'], verts=12))
    for i in range(3):
        R.add('spine', box('absring%d' % i, (sx(0.27), sx(0.2), 0.03), (0, 0, z(1.15 + i * 0.07)), M['frame'], bevel=0.008))
    R.add('spine', box('absglow', (sx(0.2), 0.01, 0.012), (0, -sx(0.1) - 0.005, z(1.22)), M['glow'], bevel=0))
    # --- chest
    R.add('chest', box('torso', (sx(0.52), sx(0.31), z(0.34)), (0, 0, z(1.47)), M['armor'], bevel=0.045))
    R.add('chest', box('pecL', (sx(0.2), 0.06, z(0.12)), (sx(0.15), -sx(0.15), z(1.56)), M['armor'], bevel=0.02))
    R.add('chest', box('pecR', (sx(0.2), 0.06, z(0.12)), (-sx(0.15), -sx(0.15), z(1.56)), M['armor'], bevel=0.02))
    R.add('chest', box('backpack', (sx(0.36), 0.14, z(0.3)), (0, sx(0.2), z(1.45)), M['frame'], bevel=0.03))
    R.add('chest', box('vent', (sx(0.26), 0.02, 0.02), (0, sx(0.27) + 0.005, z(1.5)), M['glow'], bevel=0))
    R.add('chest', box('collar', (sx(0.3), sx(0.22), 0.05), (0, 0, z(1.63)), M['frame']))
    for s in (1, -1):
        R.add('chest', sphere('shoulder%d' % s, sx(0.085), (s * shW, 0, z(1.55)), M['joint']))
        R.add('chest', box('pauldron%d' % s, (sx(0.17), sx(0.22), 0.11), (s * (shW + 0.02), 0, z(1.63)), M['armor'],
                           bevel=0.03, rot=(0, s * -18, 0)))
        R.add('chest', box('sideglow%d' % s, (0.01, sx(0.18), 0.012), (s * sx(0.262), 0, z(1.4)), M['glow'], bevel=0))
        if cannons:
            R.add('chest', cyl('cannon%d' % s, 0.06, 0.42, (s * (shW + 0.05), -0.05, z(1.76)), M['frame'], rot=(90, 0, 0)))
            R.add('chest', torus('cannonring%d' % s, 0.065, 0.012, (s * (shW + 0.05), -0.25, z(1.76)), M['glow'], rot=(90, 0, 0)))
    chest_w = 0.3 if k < 1.2 else 0.34
    if 'chest' in panels:
        panel(R, M, 'chest', 'chest', (0, -sx(0.155) - 0.012, z(1.44)), chest_w, 0.19)
    if 'belly' in panels:
        panel(R, M, 'hips', 'belly', (0, -sx(0.12) - 0.035, z(1.02)), 0.2, 0.12)
    # --- head
    R.add('head', cyl('neck', 0.05, 0.12, (0, 0, z(1.68)), M['joint'], verts=10))
    R.add('head', box('skull', (0.27, 0.25, 0.27), (0, 0.005, z(1.83)), M['armor'], bevel=0.03))
    R.add('head', box('crest', (0.05, 0.22, 0.04), (0, 0.01, z(1.975)), M['frame'], bevel=0.01))
    for s in (1, -1):
        R.add('head', cyl('ear%d' % s, 0.055, 0.04, (s * 0.145, 0.01, z(1.83)), M['frame'], rot=(0, 90, 0)))
        R.add('head', cyl('earglow%d' % s, 0.03, 0.01, (s * 0.168, 0.01, z(1.83)), M['glow'], rot=(0, 90, 0)))
    R.add('head', cyl('antenna', 0.006, 0.14, (0.09, 0.05, z(2.02)), M['joint'], verts=6))
    R.add('head', sphere('antennatip', 0.016, (0.09, 0.05, z(2.09)), M['glow'], seg=8, rings=5))
    if 'head' in panels:
        panel(R, M, 'head', 'head', (0, -0.125, z(1.83)), 0.21, 0.15)
    # --- limbs
    for s, L in ((1, 'L'), (-1, 'R')):
        ux = s * (shW + 0.015)
        R.add('upper_arm.' + L, box('uarm' + L, (sx(0.12), sx(0.13), z(0.26)), (ux, 0, z(1.39)), M['armor'], bevel=0.025))
        R.add('upper_arm.' + L, sphere('elbow' + L, sx(0.065), (s * (shW + 0.03), 0, z(1.24)), M['joint']))
        fx = s * (shW + 0.035)
        R.add('forearm.' + L, box('farm' + L, (sx(0.14), sx(0.15), z(0.25)), (fx, 0, z(1.1)), M['armor'], bevel=0.025))
        R.add('forearm.' + L, box('cuff' + L, (sx(0.15), sx(0.16), 0.035), (fx, 0, z(0.985)), M['frame'], bevel=0.008))
        if ('arm' + L) in panels:
            panel(R, M, 'forearm.' + L, 'arm' + L, (fx, -sx(0.075) - 0.012, z(1.1)), 0.14, 0.15)
        hx = s * (shW + 0.04)
        R.add('hand.' + L, box('palm' + L, (0.08, 0.11, 0.1), (hx, 0, z(0.9)), M['joint'], bevel=0.012))
        for i in range(3):
            R.add('hand.' + L, box('finger%s%d' % (L, i), (0.022, 0.025, 0.07), (hx - s * 0.02, -0.035 + i * 0.035, z(0.82)),
                                   M['frame'], bevel=0.005))
        R.add('hand.' + L, box('thumb' + L, (0.022, 0.025, 0.06), (hx + s * 0.03, -0.04, z(0.85)), M['frame'], bevel=0.005))
        tx = s * (hipW + 0.005)
        R.add('thigh.' + L, box('thigh' + L, (sx(0.17), sx(0.19), z(0.38)), (tx, 0, z(0.75)), M['armor'], bevel=0.03))
        R.add('thigh.' + L, sphere('hipball' + L, sx(0.07), (s * hipW, 0, z(0.95)), M['joint']))
        if ('thigh' + L) in panels:
            panel(R, M, 'thigh.' + L, 'thigh' + L, (tx, -sx(0.095) - 0.012, z(0.76)), 0.16, 0.15)
        kx = s * (hipW + 0.01)
        R.add('shin.' + L, sphere('knee' + L, sx(0.075), (kx, -0.01, z(0.53)), M['joint']))
        R.add('shin.' + L, box('kneecap' + L, (sx(0.12), 0.05, 0.1), (kx, -sx(0.075), z(0.52)), M['armor'], bevel=0.015))
        R.add('shin.' + L, box('shin' + L, (sx(0.14), sx(0.16), z(0.38)), (kx, 0.005, z(0.3)), M['armor'], bevel=0.025))
        R.add('shin.' + L, box('shinglow' + L, (0.012, 0.01, z(0.22)), (kx, -sx(0.08) - 0.006, z(0.3)), M['glow'], bevel=0))
        R.add('shin.' + L, box('calf' + L, (sx(0.11), 0.08, z(0.2)), (kx, sx(0.1), z(0.33)), M['frame'], bevel=0.015))
        R.add('foot.' + L, box('foot' + L, (sx(0.15), sx(0.28), 0.08), (kx, -0.04, 0.045), M['frame'], bevel=0.02))
        R.add('foot.' + L, box('toecap' + L, (sx(0.14), 0.06, 0.06), (kx, -0.04 - sx(0.13), 0.04), M['armor'], bevel=0.015))
    mesh = R.finish(name)
    humanoid_anims(arm, H)
    return arm, mesh


def humanoid_anims(arm, H):
    legs = lambda a, b, kneeA, kneeB: {
        'thigh.L': [('rx', a)], 'thigh.R': [('rx', b)],
        'shin.L': [('rx', kneeA)], 'shin.R': [('rx', kneeB)],
    }
    # Idle: breathing + scanning head
    make_action(arm, 'Idle', [
        (1, {'chest': [('rx', 0)], 'head': [('rz', -8)], 'upper_arm.L': [('ry', -4)], 'upper_arm.R': [('ry', 4)]}),
        (24, {'chest': [('rx', 3)], 'root': [('loc', (0, 0, -0.015))], 'head': [('rz', 8)],
              'upper_arm.L': [('ry', -7)], 'upper_arm.R': [('ry', 7)]}),
        (48, {'chest': [('rx', 0)], 'head': [('rz', -8)], 'upper_arm.L': [('ry', -4)], 'upper_arm.R': [('ry', 4)]}),
    ])
    # Walk cycle (forward swing of a leg = negative X about world axis)
    def walk(phase):
        s = math.sin(phase)
        c = math.cos(phase)
        p = {
            'thigh.L': [('rx', -28 * s)], 'thigh.R': [('rx', 28 * s)],
            'shin.L': [('rx', 32 * max(0, c))], 'shin.R': [('rx', 32 * max(0, -c))],
            'foot.L': [('rx', -10 * s)], 'foot.R': [('rx', 10 * s)],
            'upper_arm.L': [('rx', 22 * s), ('ry', -6)], 'upper_arm.R': [('rx', -22 * s), ('ry', 6)],
            'forearm.L': [('rx', -18)], 'forearm.R': [('rx', -18)],
            'hips': [('rz', 6 * s)], 'chest': [('rz', -8 * s), ('rx', 5)],
            'root': [('loc', (0, 0, -0.035 * abs(c)))],
            'head': [('rz', 4 * s)],
        }
        return p
    make_action(arm, 'Walk', [(1 + i * 4, walk(i * math.pi / 4)) for i in range(9)])
    # Attack: wind up and zap forward with the right arm
    make_action(arm, 'Attack', [
        (1, {}),
        (8, {'upper_arm.R': [('rx', 40), ('ry', 10)], 'forearm.R': [('rx', -60)], 'chest': [('rz', 18), ('rx', -4)]}),
        (13, {'upper_arm.R': [('rx', -85)], 'forearm.R': [('rx', -5)], 'chest': [('rz', -16), ('rx', 8)],
              'thigh.R': [('rx', 12)], 'thigh.L': [('rx', -14)]}),
        (20, {'upper_arm.R': [('rx', -60)], 'forearm.R': [('rx', -20)], 'chest': [('rz', -8)]}),
        (28, {}),
    ])
    # Hit: jolt back
    make_action(arm, 'Hit', [
        (1, {}),
        (4, {'chest': [('rx', -16)], 'head': [('rx', -14)], 'spine': [('rx', -6)],
             'upper_arm.L': [('ry', -25)], 'upper_arm.R': [('ry', 25)], 'root': [('loc', (0, 0.06, 0))]}),
        (14, {}),
    ])
    # PowerDown: knees buckle, torso slumps, crashes to the floor (non looping)
    make_action(arm, 'PowerDown', [
        (1, {}),
        (8, {'chest': [('rx', -10)], 'head': [('rx', -20), ('rz', 15)], 'upper_arm.L': [('ry', -30)],
             'upper_arm.R': [('ry', 30)]}),
        (20, {'thigh.L': [('rx', -70)], 'thigh.R': [('rx', -60)], 'shin.L': [('rx', 110)], 'shin.R': [('rx', 100)],
              'root': [('loc', (0, 0, -0.42 * H))], 'chest': [('rx', 25)], 'spine': [('rx', 10)],
              'head': [('rx', 35), ('rz', -10)], 'upper_arm.L': [('rx', 10), ('ry', -15)],
              'upper_arm.R': [('rx', 10), ('ry', 15)], 'forearm.L': [('rx', -30)], 'forearm.R': [('rx', -30)]}),
        (34, {'thigh.L': [('rx', -85)], 'thigh.R': [('rx', -80)], 'shin.L': [('rx', 140)], 'shin.R': [('rx', 135)],
              'root': [('loc', (0, -0.15, -0.62 * H)), ('rx', 32)], 'chest': [('rx', 35)], 'spine': [('rx', 15)],
              'head': [('rx', 50), ('rz', -20)], 'upper_arm.L': [('rx', 30), ('ry', -10)],
              'upper_arm.R': [('rx', 25), ('ry', 10)], 'forearm.L': [('rx', -10)], 'forearm.R': [('rx', -10)]}),
        (40, {'thigh.L': [('rx', -85)], 'thigh.R': [('rx', -80)], 'shin.L': [('rx', 140)], 'shin.R': [('rx', 135)],
              'root': [('loc', (0, -0.17, -0.64 * H)), ('rx', 34)], 'chest': [('rx', 36)], 'spine': [('rx', 15)],
              'head': [('rx', 55), ('rz', -22)], 'upper_arm.L': [('rx', 30), ('ry', -10)],
              'upper_arm.R': [('rx', 25), ('ry', 10)], 'forearm.L': [('rx', -10)], 'forearm.R': [('rx', -10)]}),
    ])


# ------------------------------------------------------------------ spider
def spider(name):
    M = robot_mats()
    BZ = 0.8
    corners = [(1, -1, 'FL'), (-1, -1, 'FR'), (1, 1, 'BL'), (-1, 1, 'BR')]
    bones = [
        ('root', (0, 0, 0), (0, 0, 0.2), None),
        ('body', (0, 0.1, BZ - 0.15), (0, 0.1, BZ + 0.15), 'root'),
        ('head', (0, -0.45, BZ), (0, -0.75, BZ), 'body'),
    ]
    for sx_, sy_, n in corners:
        hx, hy = sx_ * 0.38, sy_ * 0.38 + 0.1
        kx, ky = sx_ * 0.95, sy_ * 0.85 + 0.1
        fx, fy = sx_ * 1.25, sy_ * 1.12 + 0.1
        bones += [
            ('leg_up.' + n, (hx, hy, BZ), (kx, ky, BZ + 0.38), 'body'),
            ('leg_lo.' + n, (kx, ky, BZ + 0.38), (fx, fy, 0.03), 'leg_up.' + n),
        ]
    arm = make_armature(name + '_rig', bones)
    R = Rig(arm)
    R.add('body', sphere('thorax', 0.42, (0, 0.12, BZ), M['armor'], seg=18, rings=10, scale=(1.05, 1.15, 0.55)))
    R.add('body', box('spine', (0.18, 0.9, 0.12), (0, 0.15, BZ + 0.22), M['frame'], bevel=0.03))
    R.add('body', sphere('abdomen', 0.36, (0, 0.72, BZ + 0.08), M['armor'], seg=16, rings=10, scale=(0.95, 1.0, 0.7)))
    for i in range(4):
        R.add('body', box('abglow%d' % i, (0.4 - i * 0.06, 0.02, 0.015), (0, 0.5 + i * 0.12, BZ + 0.33 - i * 0.03),
                          M['glow'], bevel=0))
    R.add('body', cyl('hub', 0.28, 0.16, (0, 0.1, BZ - 0.18), M['joint'], verts=16))
    R.add('body', torus('hubring', 0.27, 0.025, (0, 0.1, BZ - 0.12), M['glow']))
    for sx_, sy_, n in corners:
        R.add('body', sphere('hip' + n, 0.1, (sx_ * 0.38, sy_ * 0.38 + 0.1, BZ), M['joint']))
    # shoulder pods with panels
    for s, L in ((1, 'L'), (-1, 'R')):
        R.add('body', box('pod' + L, (0.26, 0.26, 0.24), (s * 0.36, -0.12, BZ + 0.2), M['frame'], bevel=0.03))
        panel(R, M, 'body', 'pod' + L, (s * 0.36, -0.25 - 0.012, BZ + 0.2), 0.2, 0.16)
    # head with face panel and mandibles
    R.add('head', box('headbox', (0.42, 0.34, 0.3), (0, -0.58, BZ + 0.02), M['armor'], bevel=0.04))
    panel(R, M, 'head', 'head', (0, -0.75 - 0.012, BZ + 0.04), 0.26, 0.17)
    for s in (1, -1):
        R.add('head', box('mand%d' % s, (0.05, 0.16, 0.06), (s * 0.15, -0.8, BZ - 0.13), M['joint'], bevel=0.01,
                          rot=(0, 0, s * 15)))
        R.add('head', sphere('eye%d' % s, 0.035, (s * 0.17, -0.76, BZ + 0.15), M['glow'], seg=8, rings=5))
    # legs: rigid segments aligned to the bones
    for sx_, sy_, n in corners:
        for seg, r0, r1, mm in (('leg_up', 0.075, 0.06, M['armor']), ('leg_lo', 0.055, 0.025, M['frame'])):
            b = arm.data.bones[seg + '.' + n]
            h, t = b.head_local, b.tail_local
            d = t - h
            mid = (h + t) / 2
            o = cyl(seg + n, r0, d.length, mid, mm, verts=10, r2=r1)
            o.rotation_mode = 'QUATERNION'
            o.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(d.normalized())
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            R.add(seg + '.' + n, o)
        b = arm.data.bones['leg_lo.' + n]
        R.add('leg_lo.' + n, sphere('knee' + n, 0.075, b.head_local, M['joint']))
        R.add('leg_lo.' + n, sphere('kneeglow' + n, 0.03, b.head_local + Vector((0, 0, 0.07)), M['glow'], seg=8, rings=5))
    mesh = R.finish(name)

    def gait(ph):
        p = {'root': [('loc', (0, 0, 0.03 * math.sin(ph * 2)))], 'body': [('ry', 4 * math.sin(ph))]}
        for sx_, sy_, n in corners:
            diag = 0 if (sx_ * sy_) > 0 else math.pi
            s = math.sin(ph + diag)
            lift = max(0, s)
            p['leg_up.' + n] = [('rx', -sy_ * 0 + 18 * math.cos(ph + diag)), ('ry', -sx_ * 22 * lift)]
            p['leg_lo.' + n] = [('ry', sx_ * 10 * lift)]
        return p
    make_action(arm, 'Walk', [(1 + i * 3, gait(i * math.pi / 4)) for i in range(9)])
    make_action(arm, 'Idle', [
        (1, {'root': [('loc', (0, 0, 0))], 'head': [('rz', -10)]}),
        (20, {'root': [('loc', (0, 0, -0.04))], 'head': [('rz', 10)]}),
        (40, {'root': [('loc', (0, 0, 0))], 'head': [('rz', -10)]}),
    ])
    make_action(arm, 'Attack', [
        (1, {}),
        (8, {'body': [('rx', -14)], 'root': [('loc', (0, 0.1, 0.08))], 'leg_up.FL': [('ry', -30)], 'leg_up.FR': [('ry', 30)]}),
        (13, {'body': [('rx', 12)], 'root': [('loc', (0, -0.18, -0.05))], 'head': [('rx', 15)]}),
        (22, {}),
    ])
    make_action(arm, 'Hit', [
        (1, {}),
        (4, {'body': [('rx', -10), ('ry', 6)], 'root': [('loc', (0, 0.08, 0.04))]}),
        (12, {}),
    ])
    down = {'root': [('loc', (0, 0, -0.5))], 'body': [('ry', 8), ('rx', 6)], 'head': [('rx', 25)]}
    for sx_, sy_, n in corners:
        down['leg_up.' + n] = [('ry', sx_ * 38)]
        down['leg_lo.' + n] = [('ry', -sx_ * 50)]
    make_action(arm, 'PowerDown', [(1, {}), (8, {'body': [('rx', -8)], 'root': [('loc', (0, 0, 0.08))]}), (24, down), (36, down)])
    return arm, mesh
