-- =====================================================================
-- Patch 19 — falta grant de SELECT em profiles pro service_role
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Mesma pegadinha dos patches 06/09/17: GRANT é separado de RLS, vale
-- até pra service_role. A Edge Function gerar-etiqueta precisa checar
-- profiles.role antes de deixar gerar (e pagar) uma etiqueta — e
-- ninguém tinha precisado ler profiles como service_role até agora.
-- =====================================================================

grant select on profiles to service_role;
