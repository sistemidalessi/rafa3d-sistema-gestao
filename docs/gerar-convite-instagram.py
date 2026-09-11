# Gera o "convite" do Instagram: a imagem que vai nos grupos de WhatsApp
# junto com o texto do Rafa chamando pra seguir a conta -- retrato dele,
# a logo e o @, no fundo azul da identidade do catalogo.
#
# Roda no Blender em segundo plano (ele traz numpy, le/reescala PNG e
# renderiza texto com fonte do Windows; nao precisa instalar nada):
#
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python docs\gerar-convite-instagram.py
#
# Saidas (sobrescreve):
#   catalogo/assets/convite-instagram.png  -- 1080x1350 (4:5, o WhatsApp mostra grande)
#   catalogo/assets/convite-instagram.jpg  -- a mesma, leve, pra mandar pelo celular
#
# Pra usar uma foto de verdade do Rafa no lugar do retrato do catalogo:
# troque FOTO pelo caminho da foto (qualquer proporcao -- ela e recortada
# pra preencher o quadro, como object-fit: cover) e rode de novo.

import bpy, numpy as np, os

FOTO = r"C:\Projetos\Rafa 3D\catalogo\assets\rafa_portrait.png"
LOGO = r"C:\Projetos\Rafa 3D\catalogo\assets\logo_clean.png"
SAIDA_PNG = r"C:\Projetos\Rafa 3D\catalogo\assets\convite-instagram.png"
SAIDA_JPG = r"C:\Projetos\Rafa 3D\catalogo\assets\convite-instagram.jpg"
TMP = os.path.join(os.environ.get("TEMP", "."), "convite_texto.png")

W, H = 1080, 1350

# quadro da foto (em pixels, contados do topo)
FX0, FY0, FX1, FY1 = 150, 70, 930, 850     # 780 x 780
RAIO = 48
BORDA = 10

def carregar(caminho):
    img = bpy.data.images.load(caminho)
    img.colorspace_settings.name = 'sRGB'
    return img

def pixels(img):
    w, h = img.size
    p = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(p)
    return p.reshape(h, w, 4)[::-1]      # linha 0 = TOPO, como se le a imagem

def cobrir(img, bw, bh):
    """Reescala preservando a proporcao ate cobrir bw x bh e recorta o centro
    (o mesmo que object-fit: cover)."""
    w, h = img.size
    esc = max(bw / w, bh / h)
    nw, nh = int(round(w * esc)), int(round(h * esc))
    img.scale(nw, nh)
    p = pixels(img)
    x0 = (nw - bw) // 2
    y0 = (nh - bh) // 2
    return p[y0:y0 + bh, x0:x0 + bw]

def sdf_retangulo_redondo(xx, yy, x0, y0, x1, y1, r):
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    hw, hh = (x1 - x0) / 2.0 - r, (y1 - y0) / 2.0 - r
    qx = np.abs(xx - cx) - hw
    qy = np.abs(yy - cy) - hh
    fora = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2)
    dentro = np.minimum(np.maximum(qx, qy), 0)
    return fora + dentro - r

# ---- 1. fundo: o mesmo degrade da foto de perfil ---------------------------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
bg = np.zeros((H, W, 4), dtype=np.float32)
base = np.array([0x00/255, 0x08/255, 0x17/255], dtype=np.float32)
azul = np.array([0x00/255, 0x61/255, 0xf7/255], dtype=np.float32)
d1 = np.sqrt((xx - 0.78*W)**2 + (yy - 0.30*H)**2) / (0.62*W)
d2 = np.sqrt((xx - 0.15*W)**2 + (yy - 0.95*H)**2) / (0.75*W)
g = 0.55*np.clip(1-d1, 0, 1)**2 + 0.30*np.clip(1-d2, 0, 1)**2
for c in range(3):
    bg[:, :, c] = base[c] + (azul[c] - base[c]) * g
# pontinhos discretos, como o cartao do post
grade = ((xx.astype(np.int32) % 18 == 0) & (yy.astype(np.int32) % 18 == 0)).astype(np.float32) * 0.06
for c in range(3):
    bg[:, :, c] = bg[:, :, c] + grade
bg[:, :, 3] = 1.0

def compor(dest, cor, alpha):
    a = alpha[:, :, None] if alpha.ndim == 2 else alpha
    dest[:, :, :3] = cor * a + dest[:, :, :3] * (1 - a)

# ---- 2. sombra suave, moldura branca e a foto ------------------------------
d = sdf_retangulo_redondo(xx, yy, FX0, FY0 + 18, FX1, FY1 + 18, RAIO)
sombra = np.clip(1 - (d + 10) / 70.0, 0, 1) ** 2 * 0.55
compor(bg, np.array([0, 0, 0], dtype=np.float32), sombra)

d = sdf_retangulo_redondo(xx, yy, FX0, FY0, FX1, FY1, RAIO)
compor(bg, np.array([1, 1, 1], dtype=np.float32), np.clip(0.5 - d, 0, 1))

bw, bh = FX1 - FX0 - 2*BORDA, FY1 - FY0 - 2*BORDA
foto = cobrir(carregar(FOTO), bw, bh)
d = sdf_retangulo_redondo(xx, yy, FX0 + BORDA, FY0 + BORDA, FX1 - BORDA, FY1 - BORDA, RAIO - BORDA)
mascara = np.clip(0.5 - d, 0, 1)
recorte = bg[FY0 + BORDA:FY1 - BORDA, FX0 + BORDA:FX1 - BORDA]
compor(recorte, foto[:, :, :3], mascara[FY0 + BORDA:FY1 - BORDA, FX0 + BORDA:FX1 - BORDA])

# ---- 3. logo (recortando o fundo escuro dela pela cor do canto) ------------
logo = carregar(LOGO)
lw = 230
lh = int(round(logo.size[1] * lw / logo.size[0]))
logo.scale(lw, lh)
lp = pixels(logo).copy()
canto = lp[2, 2, :3].copy()
dist = np.sqrt(((lp[:, :, :3] - canto) ** 2).sum(axis=2))
lp[:, :, 3] = lp[:, :, 3] * np.clip((dist - 0.05) / 0.22, 0, 1)
lx = (W - lw) // 2
ly = 892
compor(bg[ly:ly + lh, lx:lx + lw], lp[:, :, :3], lp[:, :, 3])
fim_logo = ly + lh

# ---- 4. textos, renderizados pelo Blender com fonte do Windows -------------
def srgb_para_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.resolution_x = W; scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
motores = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in motores else 'BLENDER_EEVEE'
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

cam_data = bpy.data.cameras.new("cam"); cam_data.type = 'ORTHO'; cam_data.ortho_scale = max(W, H)
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam)
cam.location = (0, 0, 10); scene.camera = cam

def fonte(*candidatas):
    for f in candidatas:
        if os.path.exists(f):
            return bpy.data.fonts.load(f)
    return None

negrito = fonte(r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf")
normal = fonte(r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf")

def texto(nome, corpo, tamanho, baseline, cor, fnt):
    dados = bpy.data.curves.new(nome, type='FONT')
    dados.body = corpo
    if fnt: dados.font = fnt
    dados.size = tamanho
    dados.align_x = 'CENTER'
    dados.align_y = 'BOTTOM_BASELINE'
    mat = bpy.data.materials.new(nome); mat.use_nodes = True
    nodes = mat.node_tree.nodes
    for n in list(nodes): nodes.remove(n)
    emis = nodes.new('ShaderNodeEmission'); out = nodes.new('ShaderNodeOutputMaterial')
    emis.inputs['Color'].default_value = (srgb_para_linear(cor[0]), srgb_para_linear(cor[1]), srgb_para_linear(cor[2]), 1)
    emis.inputs['Strength'].default_value = 1.0
    mat.node_tree.links.new(emis.outputs['Emission'], out.inputs['Surface'])
    dados.materials.append(mat)
    obj = bpy.data.objects.new(nome, dados); scene.collection.objects.link(obj)
    obj.location = (0, H/2 - baseline, 0)

texto("arroba", "@rafa3d.dalessi", 74, fim_logo + 98, (255, 255, 255), negrito)
texto("chamada", "A Rafa 3D agora tem Instagram. Me segue lá!", 34, fim_logo + 160, (223, 233, 255), normal)
texto("site", "rafa3ddalessi.com.br", 28, fim_logo + 215, (111, 176, 255), normal)

scene.render.filepath = TMP
bpy.ops.render.render(write_still=True)

tx = carregar(TMP)
tp = pixels(tx)
compor(bg, tp[:, :, :3], tp[:, :, 3])

# ---- 5. salva PNG e JPEG leve ----------------------------------------------
def salvar(arr, caminho, formato, qualidade=None):
    o = bpy.data.images.new("saida", W, H, alpha=False)
    o.colorspace_settings.name = 'sRGB'
    o.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).astype(np.float32).ravel())
    o.filepath_raw = caminho
    o.file_format = formato
    if qualidade is not None:
        scene.render.image_settings.file_format = formato
        scene.render.image_settings.quality = qualidade
        scene.render.image_settings.color_mode = 'RGB'
        o.save_render(caminho, scene=scene)
    else:
        o.save()
    bpy.data.images.remove(o)

salvar(bg, SAIDA_PNG, 'PNG')
salvar(bg, SAIDA_JPG, 'JPEG', qualidade=85)
print("CONVITE OK", os.path.getsize(SAIDA_PNG), os.path.getsize(SAIDA_JPG))
