-- Club directory — the 21 "association entity" rows (13 regional ASF
-- associations + 8 cantonal sub-associations). These appear on football.ch as
-- numbered list entries (e.g. #7000), so they are managed like clubs.
--
-- Why a dedicated migration: the per-region seeds (20260625120000..240000) were
-- already applied to the DEV COPY *before* these association rows were added to
-- those files. `supabase db push` never replays an already-recorded version, so
-- the dev copy would otherwise stay at the pre-association state. This newer
-- timestamp makes the rows reach dev (and prod) through the normal push flow.
-- Idempotent (`on conflict do nothing`): on PRODUCTION the region seeds already
-- carry these rows inline, so this migration is a harmless no-op there.

insert into public.club_directory (asf_number, name, association, canton, group_key) values
  ('1000',  'Aargauer Fussballverband',                    'AFV',   'AG', null),
  ('2000',  'Innerschweizerischer Fussballverband',        'IFV',   null, null),
  ('3000',  'Fussballverband Nordwestschweiz',             'FVNWS', null, null),
  ('4000',  'Federazione Ticinese di Calcio',              'FTC',   'TI', null),
  ('5000',  'Association fribourgeoise de football',        'AFF',   'FR', null),
  ('6000',  'Association cantonale genevoise de football',  'ACGF',  'GE', null),
  ('7000',  'Association neuchâteloise de football',        'ANF',   'NE', null),
  ('8000',  'Association valaisanne de football',           'AVF',   'VS', null),
  ('9000',  'Association cantonale vaudoise de football',   'ACVF',  'VD', null),
  ('10000', 'Fussballverband Bern/Jura',                   'AFBJ',  null, null),
  ('11000', 'Fussballverband Region Zürich',               'FVRZ',  null, null),
  ('12000', 'Ostschweizer Fussballverband',                'OFV',   null, null),
  ('13000', 'Solothurner Fussballverband',                 'SOFV',  null, null),
  ('12100', 'Bündner Fussballverband',                     'OFV',   null, null),
  ('12300', 'St. Galler Kantonal-Fussballverband',         'OFV',   null, null),
  ('12500', 'Appenzeller Kantonal Fussballverband',        'OFV',   null, null),
  ('12600', 'Thurgauer Fussballverband',                   'OFV',   null, null),
  ('12800', 'Glarner Kantonal-Fussballverband',            'OFV',   null, null),
  ('10199', 'Association jurassienne de football (AJF)',    'AFBJ',  null, null),
  ('10198', 'Mittelländischer Fussballverband (MFV)',      'AFBJ',  null, null),
  ('10299', 'Seeländischer Fussballverband (SEFV)',        'AFBJ',  null, null)
on conflict (asf_number) do nothing;
