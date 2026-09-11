# Gera a foto de perfil do Instagram da Rafa 3D a partir da logo.
#
# Roda dentro do Blender em segundo plano (ele traz numpy e sabe ler e
# reescalar PNG; nao precisa instalar nada):
#
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python docs\gerar-perfil-instagram.py
#
# Saidas (sobrescreve):
#   catalogo/assets/perfil-instagram.png  -- 1080x1080, o que se sobe no Instagram
#   catalogo/assets/perfil-redondo.png    -- a mesma arte recortada em circulo, fundo transparente
#
# Por que tem recorte de cor: a logo_clean.png NAO tem transparencia, vem
# com um fundo escuro proprio. Sem recortar, esse retangulo aparece em
# cima do degrade. Ver docs/divulgacao-catalogo.md, secao Instagram.

import bpy, numpy as np

N = 1080
logo = bpy.data.images.load(r"C:\Projetos\Rafa 3D\catalogo\assets\logo_clean.png")
logo.colorspace_settings.name = 'sRGB'
lw = 700
lh = int(round(logo.size[1] * lw / logo.size[0]))
logo.scale(lw, lh)
lp = np.empty(lw * lh * 4, dtype=np.float32)
logo.pixels.foreach_get(lp)
lp = lp.reshape(lh, lw, 4)

# A logo nao tem transparencia: vem com fundo escuro proprio. Recorta
# pela distancia de cor ao canto -- o que e escuro como o fundo fica
# transparente, o que e azul/branco fica; sombras ficam meio a meio, e
# como o degrade por baixo e da mesma familia, nao aparece emenda.
canto = lp[2, 2, :3].copy()
dist = np.sqrt(((lp[:, :, :3] - canto) ** 2).sum(axis=2))
chave = np.clip((dist - 0.05) / 0.22, 0, 1)
lp[:, :, 3] = lp[:, :, 3] * chave

yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
bg = np.zeros((N, N, 4), dtype=np.float32)
base = np.array([0x00/255, 0x08/255, 0x17/255], dtype=np.float32)
azul = np.array([0x00/255, 0x61/255, 0xf7/255], dtype=np.float32)
d1 = np.sqrt((xx - 0.72*N)**2 + (yy - 0.72*N)**2) / (0.62*N)
d2 = np.sqrt((xx - 0.22*N)**2 + (yy - 0.18*N)**2) / (0.70*N)
g = 0.55*np.clip(1-d1, 0, 1)**2 + 0.28*np.clip(1-d2, 0, 1)**2
for c in range(3):
    bg[:, :, c] = base[c] + (azul[c] - base[c]) * g
bg[:, :, 3] = 1.0

ox = (N - lw) // 2
oy = (N - lh) // 2
a = lp[:, :, 3:4]
bg[oy:oy+lh, ox:ox+lw, :3] = lp[:, :, :3] * a + bg[oy:oy+lh, ox:ox+lw, :3] * (1 - a)

def salvar(arr, caminho):
    img = bpy.data.images.new("saida", N, N, alpha=True)
    img.colorspace_settings.name = 'sRGB'
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.filepath_raw = caminho
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)

salvar(bg, r"C:\Projetos\Rafa 3D\catalogo\assets\perfil-instagram.png")

r = np.sqrt((xx - (N-1)/2)**2 + (yy - (N-1)/2)**2)
mask = np.clip((N/2 - 1.0) - r + 0.5, 0, 1)
red = bg.copy()
red[:, :, 3] = mask
salvar(red, r"C:\Projetos\Rafa 3D\catalogo\assets\perfil-redondo.png")
print("PERFIL OK", lw, lh)
