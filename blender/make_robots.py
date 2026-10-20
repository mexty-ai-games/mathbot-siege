"""blender --background --factory-startup --python make_robots.py -- <outdir> [preview]"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, math
from mathutils import Vector
from lib import reset, export_glb, tri_count
import robots

args = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(args[0])
PREVIEW = 'preview' in args
os.makedirs(OUT, exist_ok=True)


def preview(name, arm, clips, cam_dist=4.2, cam_z=1.1):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x, sc.render.resolution_y = 360, 360
    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.location = (cam_dist * 0.55, -cam_dist, cam_z + 0.5)
    d = Vector((0, 0, cam_z)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    for clip, frames in clips:
        act = bpy.data.actions[clip]
        arm.animation_data.action = act
        try:
            arm.animation_data.action_slot = act.slots[0]
        except Exception:
            pass
        for f in frames:
            sc.frame_set(f)
            sc.render.filepath = os.path.join(OUT, 'preview', '%s_%s_%02d.png' % (name, clip, f))
            bpy.ops.render.render(write_still=True)
    arm.animation_data.action = None
    bpy.data.objects.remove(cam)


def build(name, fn, **kw):
    reset()
    arm, mesh = fn(name, **kw) if kw else fn(name)
    print('[%s] tris=%d bones=%d actions=%s' % (name, tri_count([mesh]), len(arm.data.bones),
                                                [a.name for a in bpy.data.actions]))
    export_glb(os.path.join(OUT, name + '.glb'))
    if PREVIEW:
        preview(name, arm, [('Idle', [1]), ('Walk', [1, 9, 17]), ('Attack', [13]), ('Hit', [4]), ('PowerDown', [20, 40])],
                cam_dist={'robot_spider': 5.5, 'robot_titan': 6.5}.get(name, 4.4), cam_z={'robot_spider': 0.7, 'robot_scout': 1.5, 'robot_titan': 1.5}.get(name, 1.1))
    print('[%s] size=%d bytes' % (name, os.path.getsize(os.path.join(OUT, name + '.glb'))))


build('robot_drone', robots.humanoid)
build('robot_mech', robots.humanoid, bulk=1.4,
      panels=('head', 'chest', 'belly', 'armL', 'armR', 'thighL', 'thighR'), cannons=True)
build('robot_spider', robots.spider)
build('robot_scout', robots.scout)
build('robot_titan', robots.titan)
