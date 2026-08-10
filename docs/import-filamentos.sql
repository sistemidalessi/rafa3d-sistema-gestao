-- =====================================================================
-- Cadastro das 30 cores de filamento já usadas no catálogo, a R$ 99,00/kg.
-- Material default 'PLA' (ajuste depois se alguma cor for de outro material).
-- Seguro rodar de novo: on conflict atualiza o custo em vez de duplicar.
-- =====================================================================
create unique index if not exists filament_colors_name_uq on filament_colors(name);

insert into filament_colors (name, hex_or_gradient, cost_per_kg)
values
('Branco', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #f3f3f3', 99.00),
('Branco Marmorizado', 'linear-gradient(135deg,#ffffff,#e4e4e8 38%,#c7c7cf 58%,#fbfbfc)', 99.00),
('Crystal Clear (Transparente)', 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(220,230,235,0.5) 50%, rgba(255,255,255,0.9))', 99.00),
('Prata Alumínio', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #9aa0a6', 99.00),
('Preto Brilhante', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #0d0d12', 99.00),
('Preto Fosco', '#1c1c1f', 99.00),
('Preto Eclipse', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #0a0a0d', 99.00),
('Preto Perolado Metalizado', 'linear-gradient(135deg,#454552,#16161e 62%)', 99.00),
('Azul Escuro Brilhante', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #0a2a8c', 99.00),
('Azul Escuro Fosco', '#2a3d6e', 99.00),
('Azul Céu', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #4db8d4', 99.00),
('Vermelho', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #cf2026', 99.00),
('Vermelho Marsala', '#6e1a26', 99.00),
('Vermelho e Preto (Silk)', 'linear-gradient(135deg,#8c1c24,#1a1a1e 55%,#8c1c24)', 99.00),
('Rosa Pink Brilhante', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #ca1c87', 99.00),
('Rosa Bebê', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #f0d3d8', 99.00),
('Laranja', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #e8631b', 99.00),
('Amarelo Ouro', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #f3b50a', 99.00),
('Amarelo Solar', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #f2c015', 99.00),
('Dourado', 'linear-gradient(135deg,#efd793,#c79f33 48%,#8a6a1e)', 99.00),
('Verde Brilhante', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #139140', 99.00),
('Verde Escuro', '#123e22', 99.00),
('Roxo', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #5b2a86', 99.00),
('Glow Reactor (Fosforescente)', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #d8f2c9', 99.00),
('Marrom', '#4a2d1a', 99.00),
('Marrom Terra', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #8a3f2e', 99.00),
('Metal Bronze', 'linear-gradient(135deg,#dcb78b,#9a7340 48%,#5e4220)', 99.00),
('Areia Duna', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #c9b183', 99.00),
('Bege Natural', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #e8d9ae', 99.00),
('Caucasiano (Cor da Pele)', 'radial-gradient(circle at 33% 27%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #d9a878', 99.00)
on conflict (name) do update set hex_or_gradient = excluded.hex_or_gradient, cost_per_kg = excluded.cost_per_kg;
