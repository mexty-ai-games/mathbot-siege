"""Shared helpers for the MathBot Siege Blender asset pipeline (Blender 5.x, headless)."""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- materials
def mat(name, color, metal=0.5, rough=0.4, emit=None, strength=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    m.diffuse_color = (*(emit or color), 1)
    return m


def image_from_array(name, arr):
    """arr: HxWx4 float32 in 0..1 (top row first)."""
    h, w, _ = arr.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).astype(np.float32).ravel())
    img.file_format = 'PNG'
    img.pack()
    return img


def tex_mat(name, base_img, emit_img=None, emit_strength=1.0, metal=0.6, rough=0.45, rough_img=None):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = base_img
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit_img is not None:
        t2 = nt.nodes.new('ShaderNodeTexImage'); t2.image = emit_img
        nt.links.new(t2.outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


# ---------------------------------------------------------------- geometry
def _finish(o, m, bevel, smooth_angle=35):
    if bevel > 0:
        mod = o.modifiers.new('bev', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if m is not None:
        o.data.materials.append(m)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
    except Exception:
        bpy.ops.object.shade_flat()
    return o


def box(name, size, loc, m, bevel=0.012, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=[math.radians(a) for a in rot])
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, m, bevel)


def profile(name, pts, width, m, x=0.0, bevel=0.006):
    """Side silhouette `pts` [(y, z), ...] (counter-clockwise, seen from +X) extruded `width` along X, centred on x."""
    bm = bmesh.new()
    a = [bm.verts.new((x - width / 2, y, z)) for y, z in pts]
    b = [bm.verts.new((x + width / 2, y, z)) for y, z in pts]
    n = len(pts)
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    return _finish(o, m, bevel)


def cyl(name, r, depth, loc, m, rot=(0, 0, 0), verts=16, bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc,
                                            rotation=[math.radians(a) for a in rot])
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc,
                                        rotation=[math.radians(a) for a in rot])
    o = bpy.context.active_object
    o.name = name
    return _finish(o, m, bevel)


def sphere(name, r, loc, m, seg=14, rings=8, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


def torus(name, R, r, loc, m, rot=(0, 0, 0), maj=32, mino=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=maj, minor_segments=mino,
                                     location=loc, rotation=[math.radians(a) for a in rot])
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


def world_uv(o, scale=1.0):
    """Planar UVs from the dominant normal axis, in metres / scale (tiles textures on any box)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    mw = o.matrix_world
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            p = mw @ l.vert.co
            if ax == 0:
                u, v = p.y, p.z
            elif ax == 1:
                u, v = p.x, p.z
            else:
                u, v = p.x, p.y
            l[uv].uv = (u / scale, v / scale)
    bm.to_mesh(o.data)
    bm.free()


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


def tri_count(objs):
    t = 0
    for o in objs:
        if o.type == 'MESH':
            for p in o.data.polygons:
                t += len(p.vertices) - 2
    return t


# ---------------------------------------------------------------- rigging
def make_armature(name, bones):
    """bones: list of (name, head, tail, parent)."""
    ad = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, ad)
    bpy.context.collection.objects.link(arm)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for n, h, t, p in bones:
        eb = ad.edit_bones.new(n)
        eb.head = h
        eb.tail = t
        eb.roll = 0
        if p:
            eb.parent = ad.edit_bones[p]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return arm


class Rig:
    """Collects rigid parts per bone, then joins them into one skinned mesh."""

    def __init__(self, arm):
        self.arm = arm
        self.parts = []

    def add(self, bone, *objs):
        for o in objs:
            vg = o.vertex_groups.new(name=bone)
            vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
            self.parts.append(o)
        return objs[0] if len(objs) == 1 else objs

    def socket(self, name, bone, loc, w, h, rot=(0, 0, 0)):
        """Empty marking a number panel: three.js puts a glowing digit screen here (+Z of the empty after export)."""
        e = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(e)
        e.empty_display_type = 'PLAIN_AXES'
        e.empty_display_size = 0.05
        # Blender front is -Y; glTF converts so -Y -> +Z. Rotation is applied on top.
        world = Matrix.Translation(Vector(loc)) @ Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4()
        b = self.arm.data.bones[bone]
        e.parent = self.arm
        e.parent_type = 'BONE'
        e.parent_bone = bone
        bone_world = self.arm.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))
        e.matrix_parent_inverse = bone_world.inverted()
        e.matrix_basis = world
        e['panel_w'] = w
        e['panel_h'] = h
        return e

    def finish(self, name):
        mesh = join(self.parts, name)
        mesh.parent = self.arm
        mod = mesh.modifiers.new('Armature', 'ARMATURE')
        mod.object = self.arm
        return mesh


def rot_world(arm, bone, axis, deg):
    """Quaternion in pose-bone space equal to a rotation about a WORLD (rest) axis."""
    b = arm.data.bones[bone]
    rest = b.matrix_local.to_quaternion()
    a = rest.inverted() @ Vector(axis)
    return Quaternion(a.normalized(), math.radians(deg))


def make_action(arm, name, keys, fps=24):
    """keys: list of (frame, {bone: [('rx'|'ry'|'rz', deg) | ('loc', (x,y,z) world-up)] }).
    Rotations are about world axes through each bone's head (rest pose)."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    for f, pose in keys:
        for pb in arm.pose.bones:
            pb.rotation_quaternion = Quaternion()
            pb.location = (0, 0, 0)
        for bn, ops in pose.items():
            pb = arm.pose.bones[bn]
            q = Quaternion()
            for op, v in ops:
                if op == 'loc':
                    rest = arm.data.bones[bn].matrix_local.to_quaternion()
                    pb.location = rest.inverted() @ Vector(v)
                else:
                    ax = {'rx': (1, 0, 0), 'ry': (0, 1, 0), 'rz': (0, 0, 1)}[op]
                    q = rot_world(arm, bn, ax, v) @ q
            pb.rotation_quaternion = q
        for pb in arm.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=f)
            pb.keyframe_insert('location', frame=f)
    tr = arm.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, int(keys[0][0]), act)
    tr.mute = True
    arm.animation_data.action = None
    return act


def export_glb(path, objs=None):
    bpy.ops.object.select_all(action='DESELECT')
    kw = dict(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
              export_extras=True, export_animations=True, export_animation_mode='ACTIONS',
              export_skins=True, export_def_bones=False, export_image_format='AUTO')
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        kw.pop('export_def_bones', None)
        bpy.ops.export_scene.gltf(**kw)
