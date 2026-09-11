# Troca o link do rodape da arte do catalogo (arte-catalogo.png) e refaz o
# JPEG leve (arte-catalogo-link.jpg). O gerador original da arte nao esta
# no repositorio, entao este script trabalha em cima da arte pronta: apaga
# a faixa do texto antigo (interpolando o fundo entre a linha de cima e a
# de baixo, pra nao deixar retangulo) e renderiza o texto novo com o
# Blender por cima, em Segoe UI (parecida com a Manrope da arte).
#
# Roda no Blender em segundo plano (ele traz numpy):
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python docs\atualizar-rodape-arte-catalogo.py
#
# ORIG precisa ser a arte SEM o rodape novo (a versao antiga fica em
# catalogo/assets/arte-catalogo-original.png). Rodar duas vezes em cima
# do resultado apaga e reescreve a mesma faixa, sem estrago.

# Troca o link do rodapé da arte do catálogo (arte-catalogo.png) sem mexer
# no resto. O gerador original da arte não está no repositório; este script
# apaga a faixa do texto antigo (copiando a cor de fundo de cada linha) e
# renderiza o texto novo com o Blender por cima. Gera também o JPEG leve
# (arte-catalogo-link.jpg) que o WhatsApp usa pro cartão do link.
import bpy, numpy as np, os

ORIG = "C:/Projetos/Rafa 3D/catalogo/assets/arte-catalogo-original.png"
SAIDA_PNG = r"C:\Projetos\Rafa 3D\catalogo\assets\arte-catalogo.png"
SAIDA_JPG = r"C:\Projetos\Rafa 3D\catalogo\assets\arte-catalogo-link.jpg"
TMP = os.path.join(os.environ.get("TEMP", "."), "rodape_texto.png")
TEXTO = "rafa3ddalessi.com.br"
Y0, Y1 = 946, 974          # faixa (linhas, contadas do topo) onde estava o link antigo
X0, X1 = 280, 800
BASELINE = 966             # linha do pé das letras
COR = (175, 176, 179)      # cinza do texto antigo

# ---- 1. apaga o texto antigo ---------------------------------------------
img = bpy.data.images.load(ORIG)
W, H = img.size
px = np.empty(W*H*4, dtype=np.float32); img.pixels.foreach_get(px)
px = px.reshape(H, W, 4)          # linha 0 = BASE da imagem (Blender)
for y_topo in range(Y0, Y1):
    y = H - 1 - y_topo
    # fundo interpolado entre a linha logo acima e logo abaixo da faixa
    # (as duas sem texto): acompanha o degrade horizontal, sem deixar
    # um retangulo mais claro no lugar do texto antigo.
    t = (y_topo - (Y0 - 2)) / float((Y1 + 1) - (Y0 - 2))
    acima = px[H - 1 - (Y0 - 2), X0:X1, :3]
    abaixo = px[H - 1 - (Y1 + 1), X0:X1, :3]
    px[y, X0:X1, :3] = acima * (1 - t) + abaixo * t

# ---- 2. renderiza só o texto novo, com fundo transparente -----------------
def srgb_para_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.resolution_x = W; scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

cam_data = bpy.data.cameras.new("cam"); cam_data.type = 'ORTHO'; cam_data.ortho_scale = W
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam)
cam.location = (0, 0, 10); scene.camera = cam

fonte = None
for f in [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"]:
    if os.path.exists(f):
        fonte = bpy.data.fonts.load(f); break

txt_data = bpy.data.curves.new("rodape", type='FONT')
txt_data.body = TEXTO
if fonte: txt_data.font = fonte
txt_data.size = 30
txt_data.align_x = 'CENTER'
txt_data.align_y = 'BOTTOM_BASELINE'
mat = bpy.data.materials.new("cinza"); mat.use_nodes = True
nodes = mat.node_tree.nodes
for n in list(nodes): nodes.remove(n)
emis = nodes.new('ShaderNodeEmission'); out = nodes.new('ShaderNodeOutputMaterial')
emis.inputs['Color'].default_value = (srgb_para_linear(COR[0]), srgb_para_linear(COR[1]), srgb_para_linear(COR[2]), 1)
emis.inputs['Strength'].default_value = 1.0
mat.node_tree.links.new(emis.outputs['Emission'], out.inputs['Surface'])
txt_data.materials.append(mat)
txt = bpy.data.objects.new("rodape", txt_data); scene.collection.objects.link(txt)
txt.location = (0, H/2 - BASELINE, 0)

scene.render.filepath = TMP
bpy.ops.render.render(write_still=True)

# ---- 3. compõe o texto por cima e salva -----------------------------------
tx = bpy.data.images.load(TMP)
tp = np.empty(W*H*4, dtype=np.float32); tx.pixels.foreach_get(tp)
tp = tp.reshape(H, W, 4)
a = tp[:, :, 3:4]
px[:, :, :3] = tp[:, :, :3] * a + px[:, :, :3] * (1 - a)
px[:, :, 3] = 1.0

def salvar(caminho, formato, qualidade=None):
    o = bpy.data.images.new("saida", W, H, alpha=False)
    o.colorspace_settings.name = 'sRGB'
    o.pixels.foreach_set(px.ravel())
    o.filepath_raw = caminho
    o.file_format = formato
    if qualidade is not None:
        scene.render.image_settings.file_format = formato
        scene.render.image_settings.quality = qualidade
        o.save_render(caminho, scene=scene)
    else:
        o.save()
    bpy.data.images.remove(o)

salvar(SAIDA_PNG, 'PNG')
salvar(SAIDA_JPG, 'JPEG', qualidade=82)
print("ARTE OK", os.path.getsize(SAIDA_PNG), os.path.getsize(SAIDA_JPG))
