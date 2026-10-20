"""Builds content/props.json (local model paths) for MathBot Siege v2. Run from the repo root."""
import json

L = lambda en, fr: {'en': en, 'fr': fr}

p = json.load(open('content/props.json', encoding='utf8'))
ui = p['ui']
for k in ['victoryTitle', 'victoryText']:
    ui.pop(k, None)
ui.update({
    'howToSteps': [
        L("Robots march out of the portals with a math problem floating above their head.", "Les robots sortent des portails avec un calcul affiché au-dessus de leur tête."),
        L("Every robot shows numbers on its screens. Only ONE screen has the right answer: shoot it to power the robot down.", "Chaque robot affiche des nombres sur ses écrans. UN SEUL a la bonne réponse : tire dessus pour éteindre le robot."),
        L("Powered-down robots drop energy cores ◆. Spend them between waves on new weapons and upgrades.", "Les robots éteints lâchent des cristaux d'énergie ◆. Dépense-les entre les vagues pour de nouvelles armes et améliorations."),
        L("A wrong answer or a robot that reaches you costs one shield cell. How many waves can you survive?", "Une mauvaise réponse ou un robot qui t'atteint te coûte une cellule de bouclier. Combien de vagues tiendras-tu ?"),
    ],
    'controlsDesktop': L("Mouse to aim, click to shoot, right-click to zoom with the sniper, WASD or ZQSD to move, 1-4 or the wheel to switch weapon, R to reload, Esc to pause.", "Souris pour viser, clic pour tirer, clic droit pour zoomer au sniper, ZQSD ou WASD pour bouger, 1-4 ou la molette pour changer d'arme, R pour recharger, Échap pour la pause."),
    'controlsTouch': L("Left stick to move, drag on the right to look. Tap a screen to shoot it, or hold FIRE. Tap a weapon to switch, ⌖ to zoom.", "Joystick à gauche pour bouger, glisse à droite pour regarder. Touche un écran pour tirer dessus, ou maintiens TIR. Touche une arme pour changer, ⌖ pour zoomer."),
    'controlsKeyboard': L("Keyboard only: Tab jumps your aim to the next answer screen, Space shoots, F zooms, arrows turn.", "Au clavier : Tab place ta visée sur l'écran suivant, Espace tire, F zoome, les flèches tournent."),
    'bossIncoming': L("TITAN INCOMING", "UN TITAN ARRIVE"),
    'bestWave': L("Wave", "Vague"),
    'cores': L("Cores", "Cristaux"),
    'zoom': L("Zoom", "Zoom"),
    'switchWeapon': L("Weapons", "Armes"),
    'endRun': L("End run", "Terminer la partie"),
    'longShot': L("Long shot!", "Tir de loin !"),
    'lootShield': L("Shield cell recovered!", "Cellule de bouclier récupérée !"),
    'briefing': L("Mission briefing", "Briefing de mission"),
    'lesson': L("Quick lesson", "Petite leçon"),
    'skipLesson': L("Got it!", "Compris !"),
    'hideLessons': L("Don't show lessons", "Ne plus afficher les leçons"),
    'shop': L("Armory", "Armurerie"),
    'shopHint': L("Spend the cores you collected. Upgrades last until the end of this run.", "Dépense les cristaux récoltés. Les améliorations durent jusqu'à la fin de la partie."),
    'unlock': L("Unlock", "Débloquer"),
    'equip': L("Equip", "Équiper"),
    'equipped': L("Equipped", "Équipée"),
    'maxed': L("Maxed", "Au max"),
    'level': L("Level", "Niveau"),
    'startRun': L("Start wave 1", "Lancer la vague 1"),
    'nextWave': L("Wave", "Vague"),
    'defeatTitle': L("Shields down!", "Bouclier épuisé !"),
    'defeatText': L("Great run! Every wave makes your math faster. Can you beat your best wave?", "Belle partie ! Chaque vague rend tes calculs plus rapides. Bats-tu ta meilleure vague ?"),
})
p.pop('waves', None)
p['endless'] = {'startRobots': 3, 'robotsPerWave': 1.5, 'maxRobots': 26, 'mechFrom': 3, 'spiderFrom': 4, 'scoutFrom': 2, 'bossEvery': 5,
                'speedStart': 0.8, 'speedPerWave': 0.05, 'speedCap': 1.6, 'maxActiveStart': 2, 'maxActiveCap': 7}
p['settings'] = {'shield': 8, 'robotZapDamage': 1, 'wrongAnswerDamage': 1, 'hintAfterMistakes': 2,
                 'numbers': {'addMaxStart': 10, 'addMaxStep': 5, 'addMaxCap': 100, 'mulMaxStart': 5, 'mulMaxCap': 12}}
p['weapons'] = [
    {'id': 'pistol', 'name': L("Pulse pistol", "Pistolet à impulsion"), 'description': L("Reliable and precise. Your starter.", "Fiable et précis. Ton arme de départ."),
     'cost': 0, 'fireRate': 0.22, 'magazine': 12, 'reload': 1.1, 'auto': False, 'aimAssistPx': 16, 'pellets': 1, 'zoomFov': 0, 'color': '#3a8bff'},
    {'id': 'rifle', 'name': L("Vector rifle", "Fusil vectoriel"), 'description': L("Automatic: hold the trigger to keep firing.", "Automatique : garde la gâchette pour tirer en rafale."),
     'cost': 25, 'fireRate': 0.11, 'magazine': 30, 'reload': 1.6, 'auto': True, 'aimAssistPx': 12, 'pellets': 1, 'zoomFov': 0, 'color': '#ff8a1a'},
    {'id': 'shotgun', 'name': L("Scatter shotgun", "Fusil à dispersion"), 'description': L("Wide blast: the screen nearest your aim is hit, even if you are a bit off.", "Tir large : l'écran le plus proche de ta visée est touché, même un peu à côté."),
     'cost': 40, 'fireRate': 0.75, 'magazine': 6, 'reload': 1.9, 'auto': False, 'aimAssistPx': 70, 'pellets': 7, 'zoomFov': 0, 'color': '#ff3a6a'},
    {'id': 'sniper', 'name': L("Cipher sniper", "Sniper Cipher"), 'description': L("Zoom in and solve from far away. Long shots score 1.5×.", "Zoome et résous de très loin. Les tirs de loin valent 1,5×."),
     'cost': 55, 'fireRate': 0.9, 'magazine': 5, 'reload': 2.0, 'auto': False, 'aimAssistPx': 8, 'pellets': 1, 'zoomFov': 16, 'color': '#4dff7a'},
]
p['upgrades'] = [
    {'id': 'shield', 'name': L("Shield cell", "Cellule de bouclier"), 'description': L("+1 maximum shield.", "+1 bouclier maximum."), 'cost': 20, 'costGrowth': 1.6, 'maxLevel': 4, 'icon': '🛡️'},
    {'id': 'reload', 'name': L("Quick loader", "Recharge rapide"), 'description': L("Reload 18% faster.", "Recharge 18 % plus vite."), 'cost': 15, 'costGrowth': 1.6, 'maxLevel': 3, 'icon': '⚡'},
    {'id': 'magazine', 'name': L("Big magazines", "Grands chargeurs"), 'description': L("+30% shots per magazine.", "+30 % de tirs par chargeur."), 'cost': 15, 'costGrowth': 1.6, 'maxLevel': 3, 'icon': '🔋'},
    {'id': 'repair', 'name': L("Repair kit", "Kit de réparation"), 'description': L("Refill your shield now.", "Remplit ton bouclier maintenant."), 'cost': 12, 'costGrowth': 1, 'maxLevel': 0, 'icon': '🔧'},
    {'id': 'scanner', 'name': L("Answer scanner", "Scanner de réponse"), 'description': L("The right screen blinks green after just one mistake.", "Le bon écran clignote en vert dès la première erreur."), 'cost': 30, 'costGrowth': 1, 'maxLevel': 1, 'icon': '🔍'},
]
p['lessons'] = [
    {'op': 'add', 'title': L("Jumps on the number line", "Des bonds sur la droite numérique"), 'a': 8, 'b': 5, 'lines': [
        L("Adding means moving forward. Start at the first number and jump forward by the second.", "Additionner, c'est avancer. Pars du premier nombre et fais un bond égal au second."),
        L("8 + 5: from 8, jump 5 steps → 13.", "8 + 5 : depuis 8, avance de 5 → 13.")]},
    {'op': 'add', 'title': L("Make a ten first", "Fais d'abord une dizaine"), 'a': 7, 'b': 6, 'lines': [
        L("7 needs 3 more to make 10. Take 3 from the 6: 7 + 3 = 10, then 10 + 3 = 13.", "Il manque 3 à 7 pour faire 10. Prends 3 dans le 6 : 7 + 3 = 10, puis 10 + 3 = 13."),
        L("Tens are easy to add, so aim for them!", "Les dizaines sont faciles à ajouter : vise-les !")]},
    {'op': 'add', 'title': L("Order doesn't matter", "L'ordre ne compte pas"), 'a': 4, 'b': 9, 'lines': [
        L("4 + 9 is the same as 9 + 4. Start from the bigger number and count on: 9… 10, 11, 12, 13.", "4 + 9, c'est pareil que 9 + 4. Pars du plus grand et compte : 9… 10, 11, 12, 13.")]},
    {'op': 'sub', 'title': L("Taking away", "Enlever"), 'a': 12, 'b': 5, 'lines': [
        L("Subtracting means taking some away and counting what is left.", "Soustraire, c'est enlever et compter ce qui reste."),
        L("12 − 5: cross out 5 of the 12 dots → 7 are left.", "12 − 5 : barre 5 des 12 points → il en reste 7.")]},
    {'op': 'sub', 'title': L("Count up to find the gap", "Compte la différence"), 'a': 15, 'b': 9, 'lines': [
        L("15 − 9 is the gap between 9 and 15. Count up from 9: 10, 11, 12, 13, 14, 15 → 6 steps.", "15 − 9, c'est l'écart entre 9 et 15. Compte depuis 9 : 10, 11, 12, 13, 14, 15 → 6 pas.")]},
    {'op': 'sub', 'title': L("Check with addition", "Vérifie avec une addition"), 'a': 14, 'b': 6, 'lines': [
        L("If 14 − 6 = 8, then 8 + 6 must give 14 again. It does, so the answer is right!", "Si 14 − 6 = 8, alors 8 + 6 doit redonner 14. C'est le cas : la réponse est juste !")]},
    {'op': 'mul', 'title': L("Rows of dots", "Des rangées de points"), 'a': 3, 'b': 4, 'lines': [
        L("3 × 4 means 3 rows of 4. Count them: 4, 8, 12.", "3 × 4, c'est 3 rangées de 4. Compte-les : 4, 8, 12."),
        L("Multiplying is fast repeated adding: 4 + 4 + 4 = 12.", "Multiplier, c'est additionner plusieurs fois très vite : 4 + 4 + 4 = 12.")]},
    {'op': 'mul', 'title': L("Turn it around", "Retourne-le"), 'a': 6, 'b': 7, 'lines': [
        L("6 × 7 = 7 × 6: the same dots, just turned. Learn one fact and you get two!", "6 × 7 = 7 × 6 : les mêmes points, juste tournés. Apprends un résultat, tu en gagnes deux !"),
        L("6 × 7 = 42.", "6 × 7 = 42.")]},
    {'op': 'mul', 'title': L("Double, then double again", "Double, puis encore double"), 'a': 4, 'b': 8, 'lines': [
        L("To multiply by 4, double twice: 8 → 16 → 32. So 4 × 8 = 32.", "Pour multiplier par 4, double deux fois : 8 → 16 → 32. Donc 4 × 8 = 32.")]},
    {'op': 'div', 'title': L("Sharing equally", "Partager en parts égales"), 'a': 12, 'b': 3, 'lines': [
        L("12 ÷ 3 means sharing 12 into 3 equal groups.", "12 ÷ 3, c'est partager 12 en 3 groupes égaux."),
        L("Each group gets 4, so 12 ÷ 3 = 4.", "Chaque groupe reçoit 4, donc 12 ÷ 3 = 4.")]},
    {'op': 'div', 'title': L("Use your times tables", "Utilise tes tables"), 'a': 35, 'b': 5, 'lines': [
        L("35 ÷ 5 asks: 5 times what makes 35? 5 × 7 = 35, so the answer is 7.", "35 ÷ 5 demande : 5 fois combien font 35 ? 5 × 7 = 35, donc la réponse est 7.")]},
    {'op': 'div', 'title': L("Check by multiplying", "Vérifie en multipliant"), 'a': 24, 'b': 4, 'lines': [
        L("If 24 ÷ 4 = 6, then 6 × 4 must give 24. It does!", "Si 24 ÷ 4 = 6, alors 6 × 4 doit donner 24. C'est bien le cas !")]},
]
p['loot'] = {'coresPerRobot': 1, 'shieldChance': 0.15}
p['models'] = {'drone': '/models/robot_drone.glb', 'mech': '/models/robot_mech.glb', 'spider': '/models/robot_spider.glb',
               'scout': '/models/robot_scout.glb', 'titan': '/models/robot_titan.glb', 'weapons': '/models/weapons.glb',
               'arena': '/models/arena2.glb'}
for out in ('content/props.json', 'game/src/dev-props.json'):
    json.dump(p, open(out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('ok', len(json.dumps(p, ensure_ascii=False)))

# EdVerse variant: same content, public CDN model URLs (Mexty library files served by content.mext.app)
CDN = 'https://content.mext.app/uploads/direct/6a1d470c4d0fe4fcf83e6987/'
p['models'] = {
    'drone': CDN + 'f369797b-0e9f-42e6-9552-dbb4899c2053.glb',
    'mech': CDN + 'd18f256c-dac2-400b-b53f-4c85637ba791.glb',
    'spider': CDN + '1bb0f85b-e9df-472a-a629-77aa44f0cc33.glb',
    'scout': CDN + 'f505545f-e935-4875-883b-57c05e20e4c1.glb',
    'titan': CDN + '698b75b2-818e-4022-bed8-7e7f1bc2dc87.glb',
    'weapons': CDN + '6e8d8751-3186-48da-ba14-5481a3866160.glb',
    'arena': CDN + 'e2eb01d8-a4a1-4229-a08a-8e53afa84234.glb',
}
json.dump(p, open('content/props.edverse.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('edverse ok')
