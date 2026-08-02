-- Sposta la pressione dal nome del modello ai dati tecnici.
--
-- File GENERATO da scripts/genera-normalizzazione-modelli.ts: contiene valori,
-- non logica. Il nome ripulito e la pressione di esercizio sono calcolati da
-- `parseModello`, l'unico parser del progetto, verificato sui 555 nomi reali.
-- Riscrivere quella regola in plpgsql darebbe due implementazioni destinate a
-- divergere: provato, e puntualmente divergono.
--
-- Righe rinominate:            537
-- Righe lasciate intatte:      13 (pressione massima minore di quella di esercizio)
-- Riferimenti nelle schede:    5
-- Rimandate per duplicato:     5

-- Non rinominate perche' il nome ripulito coincide con una voce gia' a
-- catalogo: sono duplicati, e scegliere quale conservare non e' una
-- decisione da migration. Restano intatte e la verifica continua a
-- segnalarle finche' non le si fonde dal modulo.
--   PADOVAN VALERIO snc · TA15 (@10,80bar) -> TA15
--   PADOVAN VALERIO snc · TW3 (@11bar) -> TW3
--   CECCATO ARIA COMPRESSA S.R.L. · CSA 10 (@10bar) -> CSA 10
--   PADOVAN VALERIO snc · TA11 (@10,80 bar) -> TA11
--   KAESER KOMPRESSOREN SE · ASD 32 (8,5-11bar) -> ASD 32

-- Le righe escluse, da verificare a mano sulla documentazione del costruttore:
--   KAESER KOMPRESSOREN SE · AIRCENTER 12 SFC (@13bar): nome 13 bar, dati tecnici 11 bar
--   KAESER KOMPRESSOREN SE · AIRCENTER 12 (@13bar): nome 13 bar, dati tecnici 11 bar
--   PADOVAN VALERIO snc · TW3 (@13bar): nome 13 bar, dati tecnici 12 bar
--   ARMATUREN- UND METALLWERKE ZÖBLITZ GMBH · SVW 8 (@16bar): nome 16 bar, dati tecnici 11.5 bar
--   KAESER KOMPRESSOREN SE · ASD 35 T (8,5-11bar): nome 11 bar, dati tecnici 8.5 bar
--   ARMATUREN- UND METALLWERKE ZÖBLITZ GMBH · 810sGK (DN8 @16bar): nome 16 bar, dati tecnici 9 bar
--   KAESER KOMPRESSOREN SE · AIRCENTER 15 (@13bar): nome 13 bar, dati tecnici 11 bar
--   KAESER KOMPRESSOREN SE · ASK 34 T SFC (11.5-15bar): nome 15 bar, dati tecnici 11 bar
--   ATLAS COPCO AIRPOWER N.V. · GA 30 (@10bar): nome 10 bar, dati tecnici 9.8 bar
--   KAESER KOMPRESSOREN SE · CSDX 165 SFC (@15bar): nome 15 bar, dati tecnici 13 bar
--   KAESER KOMPRESSOREN SE · AIRCENTER 9 (@13bar): nome 13 bar, dati tecnici 11 bar
--   PADOVAN VALERIO snc · TW3 (@14,5bar): nome 14.5 bar, dati tecnici 14 bar
--   KAESER KOMPRESSOREN SE · ASD 37 (11,5-15bar): nome 15 bar, dati tecnici 11 bar

CREATE TABLE IF NOT EXISTS equipment_catalog_normalization_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id  uuid,
  entita        text NOT NULL,
  valore_prima  jsonb,
  valore_dopo   jsonb,
  migration     text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

BEGIN;

-- Stato precedente, per poter tornare indietro.
INSERT INTO equipment_catalog_normalization_log (equipment_id, entita, valore_prima, migration)
SELECT id, 'equipment_catalog', jsonb_build_object('modello', modello, 'specs', specs),
       '20260804000000_normalize_equipment_model_pressure'
FROM equipment_catalog WHERE id IN (
  '00a2a6be-17a2-4994-b63b-e0eb5fcf7c92',
  '01716273-8f15-4633-9f67-fa476b5078ab',
  '01844c9b-2192-46eb-bf84-9565055725fe',
  '01d88bfc-e58c-40f3-a76a-840fe1ddcd06',
  '0229dd88-2fc5-4b16-8d69-b313fdc31ecb',
  '0294a015-f134-4fac-83d8-ee1a82877a69',
  '02e02cfc-6db4-4bae-95db-b2edab3101a0',
  '03a22e77-79a1-4cb1-bf63-d6c130b3dc1e',
  '03b57b87-13e3-4ae5-8898-1b259512de0b',
  '03daef4f-8c13-4771-85e6-4c1d9eb6c081',
  '057f25fc-8306-4076-a3ac-32c50b2bb250',
  '0624feb2-55b8-4f95-90a0-b1e3f7fbbe1b',
  '063105da-005e-40d0-98a0-f125662b8138',
  '06c78596-4d98-40da-8505-2de3cc19537d',
  '06f7c191-a31a-4716-9b8f-3223e3c84034',
  '073903db-3e0c-43ef-b2ae-c98152b75415',
  '0749ef0b-cb23-4d20-9539-40f8ef061c0a',
  '077711bb-47dd-4c0d-b158-73deafa6c3f2',
  '08100905-77d6-4d10-b7aa-69a47915a923',
  '08145ae0-1a05-46c1-ac80-2fc2829069f5',
  '095d2092-f11e-45aa-b516-c0e15d691cf0',
  '09e69b77-4ae1-469f-ace0-0c61f09264c4',
  '09f96850-3608-4e6f-a8cf-8c56b00c4e62',
  '0afc2b55-15db-47d0-ad4e-415c9a979c67',
  '0c26b19d-1699-4d1c-a141-43a2ba922a46',
  '0c7e2f21-8d09-4c55-8aeb-80f1fa2622f8',
  '0cad2fd8-28a1-4eff-9eac-5a501abdf797',
  '0d3711b7-9a45-42d6-bd7a-24fdc464ae3e',
  '0d50ef3b-a6e3-42c7-a9da-6d25f4a20837',
  '0d77d2e4-c338-4a85-a0a0-5fe2ba2d0c24',
  '0d93b918-5f53-44df-8566-ee8c40b0c187',
  '0de4e570-fd12-4ae3-a752-7b38b4585a29',
  '0e6a2b9a-5102-4927-af08-bfdcceb48d70',
  '0efeaa0a-48da-46c5-8a02-acc2a61ccef7',
  '0f9c3a0f-4087-4d7e-b176-3bbea7355b19',
  '106fc3d1-625d-48e8-a3ed-1644ed190680',
  '107d3eea-e15f-46a3-aa8b-4141ac50554f',
  '10e297c1-237c-4633-ab45-6f9b8b9e0805',
  '1121cf36-a617-4f3f-95e5-8adc6f5649f6',
  '115170a3-8507-480e-a77e-95954ce509b8',
  '11a3a51b-722b-44e1-a54f-b9a507c9d9db',
  '11c7da06-5554-4180-9577-9cf0535ed4cb',
  '12a76a32-4706-4edd-a760-35dc2528a573',
  '12fcdb78-49a2-46dc-8926-6802bd025f82',
  '1428300a-08fb-4811-a9d3-86a09988cf28',
  '14b0a916-36fb-4193-85f6-7c64bd181825',
  '16bc1568-0b74-4e35-91c2-d5ef3d2e23e9',
  '16c3c1df-cd82-4686-80b0-b7ea98dbaeee',
  '16fda4fe-4ce6-49e2-bf1d-3c8e4cc7d418',
  '17e53463-0456-475c-b49a-9f0ec8d6ab47',
  '1803277b-d04e-48dd-8391-892f22162010',
  '18bc76c8-a44b-4d5e-b96c-1fcdc02fd19b',
  '194734ce-8755-4462-b9ac-32eb7f5ad13b',
  '19d5cbbe-a974-41a2-a953-350b974533cb',
  '19f0b9c9-7b73-4dbe-86eb-dacd2d76ec72',
  '1b400974-b8d6-4fb9-bda5-d15d41adc163',
  '1b43bc06-fe48-4d2c-95ba-21311ee169cc',
  '1b5ce261-3e2e-46bf-ac73-a28b27dd8fca',
  '1ba66f49-af13-41d6-9fe6-8230a6d77294',
  '1bf1a736-761f-4103-8c5a-f363cac53a1b',
  '1c0d563f-d350-435a-aff0-c6ead185c14c',
  '1c2ff99b-c401-4dad-bf54-74060c9a49b2',
  '1c4595bb-18a0-41c7-876e-fe0a4d9e438e',
  '1c62da94-a48a-4fb9-9d73-be37d75ef9e2',
  '1d89ec64-84a6-49ed-8dda-d2101ba0f746',
  '1dd3c886-3548-4a92-8212-3474f1fe3e94',
  '1dd7d74c-1b35-4240-b048-73bdcb2a5294',
  '1eb64d09-52f9-4a49-85d5-bf4478c23baa',
  '2052ad7d-691b-42fd-863a-c7c42ef6fe19',
  '20e01f92-d46e-4024-b2d9-fcace6d68aa6',
  '20ea69f5-961b-492a-80e1-49f9c1a8248f',
  '2100e414-84f0-4928-bc5e-8a0f7505f3ba',
  '21e3ba8a-d976-4e24-8ba8-b2dba88d6f92',
  '220ac2bb-24e7-46d9-95f7-5dd02351861c',
  '220ad188-c315-405f-abe7-68eb47f0c156',
  '225d2738-8e83-439b-8aa3-fefcd50fd92f',
  '23884e2d-9412-407e-b7c5-8a7902e02cf3',
  '2404e232-1fba-4304-84e7-e1b55c5206e5',
  '24a2a4f2-a780-4ca2-9fa3-98af62ff7529',
  '24dc4d7c-4d14-417f-8f30-76baf010fab2',
  '24e6ce5e-cc17-4a44-ae01-b60c737fd386',
  '26d03773-fc03-48a2-87b4-4a67e3605451',
  '273daa7c-5bcb-4cc0-844f-c25b5e994a48',
  '27ea0b95-7fe4-40bc-a38f-b9205389f142',
  '286a06b3-b259-4989-a1a6-103f5a312fd3',
  '28c2d7a5-5cb0-4dc5-a845-19c54a665391',
  '29696848-b140-4087-9436-f2fb4459816b',
  '296eb3e6-801e-4207-86b5-28ad01b98899',
  '298d6205-301b-42db-8b4e-5cd9f7694ae7',
  '29928728-5cdc-44d5-9ea6-75ca2fde0505',
  '2a28c12e-1443-4076-a6e4-e5f5d6b2dc2c',
  '2a61f073-f4f0-4045-a3cb-a7ac5be99d87',
  '2a9a6bcf-6412-48e4-ae57-de7db6367419',
  '2ac5455d-f6bf-4b33-b73f-d1219923429c',
  '2acd1cd8-37db-45ec-8c32-2db318e79747',
  '2b94bdff-ccaa-4746-9fc1-c5b71d062826',
  '2ba63588-7446-4646-84ce-b4c6b89493d6',
  '2c867d19-ce40-4ca6-b1fb-ee8e85242e63',
  '2da7d9fa-474d-4153-ae52-973420280a08',
  '2e40294b-7729-49e0-8030-bfeea330502c',
  '2e450c61-7dcc-4f92-acdc-bf26c6e7d69f',
  '2e7a89f0-251a-4c58-8bce-664294556648',
  '2f268c00-e85c-45ca-817d-df9155a7d392',
  '2f484e76-a459-4e7f-9515-285cbd28dba5',
  '2f53156a-a3b2-4a54-a54e-86868ef516d2',
  '2fe81a00-b3be-4ca4-9675-7cd1021aa598',
  '3023501b-6fd6-4e8f-86df-7cdf8667d168',
  '3068c000-dd5a-4592-a276-61ca336e6cb6',
  '3093c45b-4109-4722-b45b-619f09ce4f0d',
  '30b2e8af-e049-407f-b178-35cfbb5f0644',
  '30ccc3d3-aff1-4187-9228-4e4229e3a9e4',
  '30d903a5-7096-4ae6-be62-214079f088f0',
  '30fce141-62b3-42d5-8728-731407f88912',
  '31326495-5b37-491b-81ef-481e4d0d4c54',
  '3159163f-8322-4912-a3bb-776278b62a0c',
  '317efd0f-1503-4b14-b9f5-55783fd32d12',
  '31f6a3f9-288f-4257-8030-a9ae3acbe64f',
  '322e5f33-5b0a-4713-bec9-a269b3b130bf',
  '32720cd2-2729-4fdf-afd1-0d2103812a9c',
  '33ad2a53-8de9-4acf-a310-4c2cda2ed1d9',
  '3415442c-661c-4f91-96ce-d4d8c8780a4f',
  '342fcd9f-6256-48cc-8738-4e83bc5245a0',
  '34e9c507-a645-4bba-9af4-9427f8a1e110',
  '34f02f2d-5577-424a-af29-ef79b3e96f85',
  '34f2a539-a45a-4f4b-ace2-fa1b80ec2a3f',
  '3599a72d-2d30-433e-9836-d4ea7134b7b5',
  '3636eda9-d13c-4ef2-bc17-8c19516bdc44',
  '37087169-3e95-4609-a9f7-1a9f0292c9df',
  '37210f2e-729e-4b67-afb1-334e5d305710',
  '3730a714-cab8-47e9-86c2-69d561bc360e',
  '376bd4c2-ec27-4654-9720-22ba250bdb0c',
  '38395fba-7d84-4c8b-b846-262ac598ef6b',
  '38db7dd5-acbc-4be8-83b0-e1de31bbb4ee',
  '3921517e-f48a-49ad-a090-5c5060bcdc78',
  '3a38679e-6482-4cf1-b5f5-c3fdb73c3b52',
  '3a73706f-1e85-42e7-b459-f75d7c3b309f',
  '3ac486e2-94fc-47c4-81db-c206ac92cae4',
  '3ad84845-830e-4a0c-8f7d-ba82519aac6c',
  '3afeb4c7-ffdc-4548-bbbf-f001777883e2',
  '3bfe86ef-f10d-4276-96ab-0f89b67a8cb7',
  '3ca39fcf-1e8b-452b-a9ff-69fac78915ef',
  '3cdd1ddb-beac-4c58-b141-be13579bf8f6',
  '3ce5ad48-473f-4df5-a128-792a542c0791',
  '3dd65c69-6ee0-4977-8471-9b90730365e5',
  '3de73bb4-b4af-41b4-9058-079341239edc',
  '3ee6a692-a5c1-4fcc-9a87-503f7ea5fa38',
  '3f4d6c56-f00d-47a2-abfc-03afd81da8f1',
  '404e0e68-ad80-4c0d-a070-e76488b0da9a',
  '41ca1f11-5fc0-4943-8d83-3acafc237370',
  '4266d423-b428-4a2b-8a3a-3009b748e9e3',
  '428cab2f-b379-4f2c-acfc-c2f2a9eac9f5',
  '4345f30b-504d-45fa-beb0-cebb7f0ace15',
  '4352ba92-7762-48ea-86e2-9042f8b7b072',
  '43c8fab9-4b1e-4ca3-a36c-43779d8eb944',
  '441ef1db-953f-41c4-9ac9-11ae7677b6fa',
  '451aca9d-6409-4e5f-be88-1f16207d54b5',
  '45bf2b6a-436e-4662-b659-d5819f8b2712',
  '45cce7e9-df3b-4be5-99a4-943f15c00c19',
  '462f12a8-47c1-41f0-82db-0f5a1f2ca245',
  '4668851e-8260-454f-984d-562106117ca6',
  '466effa8-7ee2-4491-b68e-0810a446e711',
  '46c95f86-f19f-4ba3-a173-92e42a3bc2cb',
  '46d4d673-68c9-409e-89c1-eace16d35172',
  '47496d90-8c9e-4c44-9204-de7776e992d8',
  '4750c720-cb90-4f3c-8bfb-c88318e84def',
  '477550a2-80be-4245-8f25-79678d7cd064',
  '47b83d68-b788-4bf2-a4fd-6d9b0f38c5ea',
  '47f8b0c1-bb08-4245-8143-f42072ac8c86',
  '480df2e9-4981-4dc3-ad29-7742762c7bdd',
  '48a93205-8079-4d9a-a75a-c3b6041685f4',
  '48b1cebe-ea97-42dd-92e9-09d9f33f76cb',
  '49040e5a-d256-4cc2-90c0-1ed0eeb034ce',
  '496faa65-b1ee-492f-ad67-96f6471923aa',
  '49e1ee4e-6946-435e-a04e-47c9c7e91eee',
  '4a342914-2f66-405d-859a-2a891c2df4cd',
  '4a40ec02-3372-475a-855b-7632d801750a',
  '4aa5464b-3098-4855-976a-e064db7a639f',
  '4ac996ce-1d97-49e2-a76b-85b571acdda4',
  '4ae40153-b306-418a-8e7b-a38adae42e89',
  '4c3d9597-b0c0-497e-b617-46ee871b32b6',
  '4c626033-c68b-4415-8fde-2593a8e8ee88',
  '4ca435c8-b4e6-40f2-bb13-9cca1f663366',
  '4d7c7376-f9c8-4e8c-88c1-40cc25e8c0e9',
  '4dc95c20-0a97-40ed-824b-87e29eb9a948',
  '4e1cf704-fd27-4bfc-903f-76027913384f',
  '4e6a30bf-45b5-4961-a7e0-43b503f88acc',
  '4fab123a-6580-4dad-b684-b3c5edef939b',
  '50873f0c-9e6a-49f2-bbaa-52e14028111d',
  '51116be7-d2e6-4bde-925a-16ac2f056075',
  '516f459f-7478-4baf-9644-33a7bbc1d747',
  '521cd950-9b6a-476b-80b7-e91f641db0e4',
  '5234853e-a73c-4610-aebb-a579358ade41',
  '5264a171-ba86-441f-8453-913ca31682ca',
  '53d3f112-037d-4fc2-8a19-76659d481d4e',
  '53fcead2-470b-40ee-be4d-001c5dfbffb7',
  '5533c970-d9a9-40e7-bb45-8b7bb859b6d9',
  '55d0947d-82b7-4534-8089-9e58703a0db5',
  '567aa4c2-6711-494d-b4d6-e08c22da3d0c',
  '5781635a-0c69-43f8-ab2f-9cd01f5d3a26',
  '57ffef0e-301e-4805-b94c-fb83df0bdbd7',
  '58004438-56a9-4dc7-bbb6-6291a77ca164',
  '5900e0a8-120b-465b-b8ba-9ef9c671e42b',
  '597d2c85-5b2e-4954-a3f6-bf75e12f52aa',
  '5c12eeee-41f8-4e69-ade5-3b40c9c57963',
  '5c3a5dfb-a2ee-4039-b54d-6b2244fba836',
  '5e0ecaea-19b0-4327-9634-cbffaf49f670',
  '5e4f6f23-d3e3-4b4e-8306-ba7a263236e7',
  '5e919749-695b-4709-8a37-6b8491fa0391',
  '5eb88171-1ce7-44da-9886-70325c46e0ff',
  '5ef5dc07-e86d-4a35-b2f7-0e2fb2de8a62',
  '60ddc0e1-0874-4380-9b16-42ce0316bd63',
  '622a0d3d-f731-4b6d-9a3f-4ef4b60fc165',
  '6242dd62-b176-4b97-8cb4-97f089e53048',
  '63709efb-469b-470c-a153-92deee7dd22b',
  '63d7b2c3-752c-480e-a516-80bf20146ac6',
  '640c1e79-8f5d-48c4-af54-54b64965008e',
  '64a7d990-baad-405d-bc29-c5cc8f349500',
  '66ce9955-df11-4608-842f-727c3a34ff36',
  '67038192-18b5-4250-ade9-b66e7b36f021',
  '68528db2-8fa7-4b68-b162-8ac807e3f35e',
  '685b4931-922b-4ef9-9a3d-d1469db3cb2a',
  '68af0489-5319-4c32-8471-dde77db5b572',
  '68dedd24-4f43-431b-8a51-89cd655c55db',
  '6a11dff8-476f-4c1e-84d1-c955bbd0bb29',
  '6a503cba-bc45-4031-b1fc-b69432a009fb',
  '6c3aeb85-144f-4e7c-9b85-ce4abb1b4e02',
  '6d790df7-7617-4972-b3cd-af271d25238a',
  '6dec94ab-6c01-43c9-888d-6f6115611bd2',
  '6e3c2e1c-a41e-495c-a03a-fd5da8c6b2c0',
  '6fcaffdc-5fc9-45b7-933a-d8a5c8789191',
  '6fea5635-7081-40f3-a518-bc3f2069cab0',
  '703e8d5b-2a89-40d6-adf4-934727740ee0',
  '703fe8ec-ad62-4d45-ac43-e6c05798410c',
  '70797442-e2bf-4372-ae4f-3e04f4368384',
  '70d514d5-e1e0-4059-83bf-1dd418b32dc9',
  '70f4086e-8222-43b3-bd2d-dda704b81241',
  '71ddec40-7d47-478e-8465-cda79d49a38e',
  '7328440f-c102-47d0-aec6-86b6c33d8894',
  '733a166a-ebce-41ed-901d-986aa7ada869',
  '735dd379-3d93-4c4c-8ac4-5542a174fd77',
  '73f58e04-8c76-4edd-acf2-7cefcf6e4d99',
  '7400b022-edc3-4657-bab3-6df6bf9242cd',
  '744ca78e-904a-4247-ae39-0c74c6d7b659',
  '74a51a5d-f532-41a2-8982-c774337d6ec3',
  '74b4609b-5c23-412c-8f56-44d11980debb',
  '74c1395d-0bd1-4b3c-b60c-989fb6d66149',
  '754dcc72-6a65-4e7a-9ea9-d2743530735b',
  '75edcd1b-8eeb-4bf2-8409-7977ffe4eba3',
  '77b0eeba-153c-4467-9a9c-00cddd71619f',
  '78593f15-b490-4cd0-94e1-f26c8456e01a',
  '787f3951-69c9-43c1-89ad-f6fbab0c25c1',
  '79b19889-1256-43ef-bd26-cd72ab586c86',
  '7ad2825d-f6a0-4de0-ab73-79506d5dafad',
  '7ada3cf3-6ffb-4674-801c-7882bd01d185',
  '7af187d7-ada6-490c-a028-b43dd06f43f5',
  '7b570bc5-7ebf-4e4e-922c-a1c67541c35f',
  '7bfe3405-c83c-45b0-9f84-b4e69e642582',
  '7c750c4c-de07-4c12-85fa-3fe500bffc71',
  '7d2f6da0-2427-4fa5-842e-3d5cb17c43ff',
  '7ece58ec-9232-4c58-a95e-70a3fb2e9149',
  '7f0ba217-04b0-4d03-b777-0a184423cb46',
  '7fefc066-f760-49a4-b58d-8f8146751276',
  '8005d1b0-bb3e-4aba-8e8a-e21d708aff11',
  '8113adf7-c206-4eed-8bc6-3711f1de534d',
  '81552657-c237-412d-a737-9c08fecb8df0',
  '82a1e357-7f89-4e92-b327-459f021fc8c0',
  '838c09ce-5116-409b-9999-7bf7db3dd33f',
  '845cf0a1-f4cc-4855-8295-451988b8c745',
  '8526a443-ffe3-4856-828f-8a6a26488ece',
  '85792533-3dea-4cf5-9127-f7d20e1fb60b',
  '8608d5d6-d1ed-4a57-8d84-23455f154b08',
  '86b83f16-bb18-43a8-9664-0e1cc50890c3',
  '87452e6f-3df9-470d-8765-70ebdad1b120',
  '883ab675-ef21-4929-9c37-9ca9ffeebb4f',
  '88978eeb-38b8-4009-8e7d-81bba598c8ee',
  '889cd30a-d593-40cd-9853-d11f2194b365',
  '88cff4f7-791d-4e2a-9a67-ed50bfeda8c5',
  '88e13def-fccf-4055-a328-3b49d037e2d9',
  '89ea826f-bbc0-4cf2-9074-f5e49a904441',
  '89ef9c44-688c-4b7c-b703-3fe7ea24dd0c',
  '89f628f4-30aa-4a3b-8245-e7049a11bde8',
  '8a09ae41-07de-4f5e-b0be-1afe9c3e092a',
  '8a4164e9-f95d-4e0c-8e11-a31a19f2de00',
  '8c712f81-c73b-4c32-a77e-22dde49856e6',
  '8c79fbbb-337d-43bd-8e40-eca194063146',
  '8c92f3fa-d295-4b6b-9811-a5c2eaa366d9',
  '8cbfaf30-0a6a-48f5-b054-c716e2332c03',
  '8cca3cec-a403-44fd-95bc-76c3d0090ac1',
  '8d0173c6-4c23-4083-9f36-0555db3799a4',
  '8e0ffa20-25e8-4f48-b487-26117878dcdd',
  '8f32c08e-d08b-425a-8b3d-006365faa699',
  '8f55e71d-d90c-47a8-9dda-db4df1992bb2',
  '8f9ea648-4901-4c39-9944-ef0347c7a583',
  '8fe57c75-f169-4bd6-a797-ba7a5a9e9520',
  '9129b4ab-ea7c-439c-bdee-ee673ec8394e',
  '91af4dc3-40b0-4427-a3b7-f4afccccb042',
  '9238a4ab-0603-4df0-88bb-f91167e8ba0e',
  '92e718ac-200b-4d1f-9b7d-419e8e4a52e6',
  '93008b78-f241-4e29-9190-9daedaae6114',
  '93766ac2-a571-4be0-b31d-ae22502e5c36',
  '9394431f-af65-4888-8c8e-3de1d8e0b53d',
  '93e6dd64-9129-4cd4-a2bd-c4005a38e0fc',
  '940b1eee-4a47-4af0-babd-4b19f1f8fa23',
  '9415e0fa-9b2c-41c3-8767-e3f9eae5c9d5',
  '94631a6c-8492-4e31-953c-b6764558fef3',
  '9467d8f2-4437-4c9e-9556-92072db9893a',
  '94b75626-6500-4758-8a5a-acbc7e1792bb',
  '94bd1205-4e71-4c55-8c7b-c36b83488953',
  '950b5275-2875-43e3-8fdc-feb52abe0ed7',
  '950b56ec-6d94-422c-956e-9501a1383bf0',
  '958a74a0-aa19-4bf7-9893-2396fef42e3f',
  '967e3be8-ef44-42a0-af56-0e616e5a2c72',
  '96fdabe4-914e-40bf-90a3-d79f21929952',
  '97035bdd-2ab8-490c-bec7-51b043cf6986',
  '98778f9a-9bd3-485d-a0eb-5f17e618817a',
  '9a0eb512-8aad-4e04-baeb-9fe0cc948a03',
  '9a5efec2-1082-49e0-8d2d-9eea9c6c6994',
  '9a98e16c-f3e5-4e85-8ac0-fcd0eb8477c9',
  '9aa901d6-286f-44fc-88c6-5d2340534a8a',
  '9ac8ee75-bdf8-4007-8aab-825fc0630d80',
  '9ae71ae3-9262-4bae-b041-ea874c49f0e4',
  '9b03c6b8-a350-490c-90bd-8ea97adef0b5',
  '9b067f19-ab05-4180-b5e4-5b790f04252e',
  '9b418e31-ba9b-4596-b57a-a50268cdb3ff',
  '9b448769-f424-44da-a4f0-642e3921b7b6',
  '9b69a48b-59a1-4fe2-bf30-82fde1f8227b',
  '9bd8f1a1-ac9f-4de2-ae36-79cfad72e60b',
  '9c6f33d3-17da-479c-8298-871eb89eb1d1',
  '9df99c70-c54e-4437-bf35-ec6269573a00',
  '9e57b18f-46a1-4274-9eda-b56a35ba6027',
  '9e5f20c9-c509-4046-a2e0-5b3bd12d4dae',
  '9e6af8c2-6d12-4f3e-8dfa-8c9d29449f03',
  '9e7571ae-909f-43d5-8144-cf4344f4062d',
  '9fd8a920-ef6e-49c5-bd81-495a5a9f434f',
  'a0ad2de3-aef5-42a0-9271-bc897e1f0670',
  'a1422e8e-65db-497a-8caf-9bc87a30e326',
  'a2facff7-2358-4b13-9d31-c2d3b61adf24',
  'a420fbba-5198-4c8a-8af4-06e8425b6277',
  'a44f6faa-360a-423c-acd2-bf45fa0fcd3c',
  'a4c245df-536f-4b71-9eb8-8353785efc66',
  'a4d36b91-c430-4109-81d6-6620db58b5f1',
  'a50d0c29-3574-4e50-b1a2-a4943828f8eb',
  'a51d009b-2402-4edc-b3d1-b967e7115834',
  'a53c0a46-df53-4a24-80d8-1e91fe4c1b4a',
  'a552db1e-2a87-49fd-9ac5-8afb18f43bc9',
  'a564d844-6ab3-4a98-af8f-1bd738f0cc8a',
  'a602ee34-ad96-4514-a3af-7ad30d3ae943',
  'a61ea715-ed92-4e61-9e1f-56bae32db3ea',
  'a66f4d88-39b0-4a42-a5bb-7ec77ee50676',
  'a7148d79-179a-49d9-a5ec-a9e5d8d93b82',
  'a7dedb8e-0885-44da-9119-6706c701b7fe',
  'a9785154-1b0a-4ef1-b490-94811f609fc1',
  'a9cc18b5-516a-4485-9e56-d45e20038179',
  'a9ccbe3b-16b0-48fb-b029-cceb2170a715',
  'aa99bcaa-2319-4f0a-9c28-77ce224bda56',
  'aaa20f09-ae86-46b7-8303-7675f0c4b276',
  'ab72e94d-b054-4cf8-9d22-12a7ec18a3b5',
  'ab7cb077-54c7-488e-b726-101aac21fa5a',
  'abb4c557-4671-49e2-81d4-433af0f4379e',
  'abf26b58-2f91-4ec5-824e-58df72501972',
  'ac64d6c3-ee0b-419b-854d-75940cc48549',
  'acdcef21-d46b-4616-9b77-f1e05a09b2d5',
  'ace50ebe-e902-4be3-b268-c2210c79cd75',
  'ad1464fd-697d-42ec-8fe1-c81bd54fbd99',
  'ad67bba0-419c-4b4f-9697-4a06ee043165',
  'ae14eb51-ef87-436b-ae05-1b54075811e9',
  'aea8e090-d182-4c74-bfaa-513f2349566e',
  'afab74a8-be11-4985-8f93-c9f2fb5a4eeb',
  'afce062f-b2c9-41d7-bd0b-9046a6b371fb',
  'b032da40-b14a-4f21-adc8-bf30507283f9',
  'b03b9ffc-e2cb-49f5-a54a-8d47ef22d58c',
  'b07d782e-cfb2-4689-b240-b5f1435dc968',
  'b0a0d642-a3e3-401d-8b2e-9c26a4bc2822',
  'b25b7b72-a95f-446a-bd33-ec133f1ac67c',
  'b3a74c3f-7b3f-4beb-8c81-b3e8a5c2ce00',
  'b3af7e22-47ba-4486-a1b4-80f4a05a88d3',
  'b3ee6704-88cf-4f24-a7a5-87bf495caaaf',
  'b453c937-180d-47fa-8f83-30b57f4358ce',
  'b4c779de-6aeb-487d-b8a2-fbf7624efe4d',
  'b4e6da62-6847-43a6-bd57-24e812ea7aba',
  'b4f31a99-3f11-4704-aaba-8c74731db86b',
  'b4f9dadd-e8cc-475f-9bf2-d13c7caa1603',
  'b54b2575-90fd-4468-b33b-093c84094c98',
  'b57e01e2-79b4-4e5b-9775-2e24176432b5',
  'b5cd9bf8-6d75-4fe8-892f-5b90f6e2560d',
  'b6745301-5551-4115-8310-76c9c61d9fec',
  'b6993cc9-b433-4e71-aae6-9d0a0a0338ac',
  'b74da734-539c-4951-829f-f71a94a18979',
  'b74e0d60-4307-4356-84cb-0e6dee9adba3',
  'b7896f24-f3de-4456-9de6-7aaed6cb5619',
  'b880a8b9-41f5-4a01-8a6d-e2601e5bde10',
  'b8d283e1-3c1f-4da2-a6a6-e7cb70a347c0',
  'b8d83ffd-f066-4fb0-ba80-4f0cbf8ffa3d',
  'b910b563-0f92-4e30-a819-c59de78f445a',
  'b928cbf1-c1d9-4d9e-add1-875f1fbc5816',
  'b98d1bb6-70ec-482a-b44c-bef07652134e',
  'b9bb8753-f0d8-482b-838c-63dce5ffa4cf',
  'ba08278e-929c-4ca7-9ada-e930df329d7c',
  'ba886fbd-05e5-4085-88f9-3d3998a3fd30',
  'bbaa6194-c4b3-4a29-912e-5c9391ae7ba6',
  'bc35df0f-59a5-4d84-ace6-d756953be6cb',
  'bda75f45-e4a6-43a2-92b3-fb58a71b724e',
  'be15f2ba-aeaa-45be-8aa3-71af1574f13c',
  'be99e3fa-9ae3-4ec1-b9c7-d4b8516f7519',
  'bee988f5-61a4-4c60-8acf-aca6f97564bc',
  'befde26c-ca09-44c5-b306-05ad880e86af',
  'bf19e909-b639-4018-9350-00a3210fdf2d',
  'bf6ac948-a36f-4d5c-8368-906b02a0d60b',
  'bfa64df0-eec0-406c-84fd-81f3e42ac795',
  'bffae5ff-65f8-44bc-ad28-72d33c5312e0',
  'c03ffea7-ab67-4998-92ba-fea9774187a1',
  'c0c0acce-5666-44de-9e47-5ec7147e97f2',
  'c16f8716-2012-41f1-9da5-7e2f2e14b339',
  'c289dd54-8973-4894-bc3f-013c18ef780a',
  'c358d6f1-0ec3-4f61-b39c-ec772716bed9',
  'c3e8f438-217b-462b-806e-abce1c28b2cd',
  'c4019d6b-9d71-41c8-bd40-3dfdb32c49e1',
  'c448bac7-0a0a-419d-ad20-58df61937e97',
  'c5aa8c72-d994-4828-90b3-cfdbd03ad0ce',
  'c7b58c3b-a2c9-42ad-8b12-5f8e0b747700',
  'c7bbf002-7dd8-42cf-99c7-ee006b93b8e4',
  'c7eb05d7-f664-4162-aa36-a66eaf0684f2',
  'c8333657-009c-42db-8773-74a2c21e3dc9',
  'c8d6978a-e695-49bc-84ff-e0c8d9ece110',
  'c97b61ca-4bc4-464e-a28c-520e46cfd3ea',
  'c99ab9ff-b3a6-4a28-8910-bfcab1458022',
  'ca34625e-66df-4d75-b1b1-6378cdc61845',
  'cac901d2-828c-46ce-93dc-af2001bfbec6',
  'cb3369a2-d9f5-4ca0-9198-a4a88eca4561',
  'ccffc857-fb7c-4dc9-ba93-0a3bfa529308',
  'cd259e98-5bac-4ad3-a044-7edcef498738',
  'cd80f295-b2b5-4a7e-8d99-8c7b536ee5ea',
  'ce1c48a4-1e17-4a3c-98ce-bb3fa33d25b4',
  'ce2245ac-02e7-449a-b58e-e9cb8b77e6a6',
  'ce3bb51d-8b8e-4970-a859-689d3eed18a2',
  'cf906778-aa4d-476d-bf26-f4e001b5e135',
  'cfa3ec83-52b1-4444-9167-f0cd12d32cef',
  'd05f6994-0afc-475a-b7be-93c6da43b901',
  'd154f637-b21e-4e03-b012-0bb771c944eb',
  'd1706a92-080f-44b3-ab8a-902e466c0915',
  'd1721876-83e3-4113-a530-2e1f098ed571',
  'd30f7223-4a26-41c6-b9f0-b3ea71c543ad',
  'd3181c70-da82-41c4-97f2-e7805ba0df6d',
  'd332d03c-1463-4483-88aa-a3fd586b124c',
  'd40a4709-b3cb-4ee7-8701-bdb0d43bc616',
  'd40ec680-f048-4e24-bb78-0980ef6b0fc2',
  'd4b69df7-e399-448a-abff-0f0b71a43fde',
  'd62ca757-e7df-4e8c-9666-c397b688cf98',
  'd66737ff-0b4e-4683-9f54-25e6f016441a',
  'd74cea8a-dcdd-4f27-83e5-c6596dba8d0c',
  'd74d2482-ed74-4b96-a8cb-50523ebb472f',
  'd76fb339-b824-4081-9a8d-92f85545f550',
  'd8291897-7ed8-4233-9339-74f6d8aaab8f',
  'd84a2b2c-df7b-4043-9a08-f323b89d5e0c',
  'd8dec2e9-7182-409c-9f4f-378fffe20b94',
  'd945a70c-fd8f-47bd-9ab3-ab075516ab19',
  'd979f3cc-3afa-427f-8c5e-c89ebbdae93a',
  'da750c53-9905-4471-9223-88bba9f8479b',
  'db1ef1b7-7009-41ab-bd63-f4c31b0e2ce5',
  'dbf250cf-9643-48eb-a4f0-b02bdfb86323',
  'dcb743c4-1b4d-4a8d-a127-216e7f5a2e1d',
  'dcd5382a-5877-45d8-a03a-8027fa5f59bd',
  'dcdaa5ea-89cc-4cca-9163-28e8aa7ff8f6',
  'dcfc62bc-ed33-4f89-8732-b651241c0a56',
  'dd88fdb5-07fe-4365-83d5-c11c0274bee9',
  'ddf06802-ca51-4926-9650-67247fbaadb8',
  'dec02ad1-f4d9-4d55-9fe6-b7a094617f12',
  'dfcf19af-756c-48fa-96df-12bfb5f23717',
  'e0221498-762e-4f63-b932-b6ae414fdfe6',
  'e115e240-a63c-41c6-8d3a-362b220f5bb2',
  'e16687ae-25a6-440c-a147-f58ca9c07f94',
  'e19fe6a5-5e94-4211-a6cc-929edfb19ac8',
  'e1d9a321-0a63-47b1-bfbc-0947d96bc9bc',
  'e1f48b8d-5244-4c2e-be2b-dd0ed093ca6b',
  'e1fd883d-2858-413b-93ad-d842d7b1bdf6',
  'e2404487-1ae9-4a8d-ad5e-625f424a8653',
  'e350b2d6-2a4c-450b-accd-3f0c030ffa5c',
  'e3b65196-365e-455d-8ebf-627498edbc9b',
  'e42f4ddd-b43e-4f09-afb1-e15f83ae3cd6',
  'e493b560-176f-4542-973b-bec7b1bd9a49',
  'e70efdc0-2049-42e7-aa3b-80bd01c716fa',
  'e74ebadb-510a-4b4b-938d-f14cdc0a96a2',
  'e79ad4c4-6561-4dda-b143-ae858c7d4370',
  'e867808d-14b1-4da1-a7d0-765fa2debe73',
  'e8cd7bf7-7565-414d-abbe-a63028dc5249',
  'e8d44b5f-3438-4f1e-8c4f-e96dc7b1b827',
  'e9234190-353f-45d4-a11a-4fbd4bf00f84',
  'e93159b3-faad-4ed6-a2bd-07175a165492',
  'e9f8cf54-803b-4b74-a727-8e51b795c2d3',
  'e9fde2f9-fc41-4dde-8e0e-b40d90c248bf',
  'eadc121a-93c8-42d6-970f-e7dda8297bad',
  'eb11e10e-64e9-4c63-957a-c4958663a2d5',
  'eb648db7-8ca0-4a54-9041-c9e20bee9bf4',
  'ebc434de-61eb-4f31-8e10-f0a4c918797b',
  'ec629de6-44e5-4c33-9b67-6c71251218f5',
  'ed5eb4ed-b4ad-4a6b-8f66-82a4a83d0820',
  'edacebec-d50c-4638-840f-9b1646565e41',
  'ee29b9b1-4a2a-4a25-a5a5-cfb75f8320dc',
  'eea3b653-85fa-4afe-8902-8ba1de0988dc',
  'eeb83d49-640d-4cc8-9dec-301fc57dfb2e',
  'f0377af8-aca4-4326-b489-360b0bf081cc',
  'f0c8f177-c21f-473c-8b6c-930d81dd1870',
  'f1520d63-b956-4645-a2be-ac20480e3bd2',
  'f17943b3-e61f-4d1a-81a8-8ddbbb0b5dc6',
  'f1f2b4a1-ea9e-4ccb-9fb0-30e3e1e9f30a',
  'f241b944-07c6-4270-a329-11554f2d08fb',
  'f27eeb00-d72d-45a2-9d13-72d6b2fc42c2',
  'f35711ac-3f7b-40cc-b178-2f8c5068d80d',
  'f35fd78d-0b22-4a45-be3f-d60f3cca304c',
  'f369498f-5b70-48a7-9176-a981e80cb4c3',
  'f37d9982-eea0-4d4f-92b1-7057b2cdc687',
  'f3dc965f-9b7b-442e-b62a-9f501d05779a',
  'f4177ae4-83db-4f57-af21-eba6b2007cf1',
  'f4a3566e-f2e1-4970-85ac-01c39b021d00',
  'f5dcdef9-98d0-4add-9a12-0827fce506df',
  'f7077ad9-a99d-41bf-9b6e-7520c0425e44',
  'f76c5807-befb-4857-aef7-932006a722d0',
  'f788d6bd-be83-4d0b-b7a9-84e50cfd46b9',
  'f7d84fe6-bd63-4938-ab8d-11321a533ff6',
  'f82c985d-e354-454b-a433-7d80febb8df1',
  'f895027d-f7b4-413e-94ba-a49f4ae7be98',
  'f9113a68-80a4-4a8d-bbab-31f41daddbdd',
  'f913ce22-b799-46d8-a42d-2ee0f4b91a20',
  'f99b7d12-be37-4f9d-9ef6-2b6c6c43b969',
  'f9edcff6-0775-4d03-91bd-cef39040a749',
  'f9fc4dce-1adc-40dc-916b-8b2b04ad5920',
  'fa8d8e87-28d3-453c-ba5b-9308c388a2a1',
  'fa9ca41f-1f09-4b3c-b722-db713f54dd39',
  'faef9867-4fef-44e5-aae4-4b5ea6105f44',
  'fc3b9c2a-eb52-4288-bf12-1d9d33df57d9',
  'fcce4573-5da0-42a2-9659-65d93e56bc27',
  'fd1d5981-1c5b-4f47-90bf-a2f0c24793cc',
  'fd951b83-a29e-40c0-95fc-c5f87f438403',
  'fe50f8ac-9ce5-46f9-b17f-c669082cdd83',
  'fe978643-1267-4e22-8193-badbae6d7eb8',
  'fea06cd8-3739-4ce1-b2b6-2044a2a1a1ba',
  'fed4cf32-e424-47cb-8cc1-a4f3a0a839b9'
);

INSERT INTO equipment_catalog_normalization_log (equipment_id, entita, valore_prima, migration)
SELECT id, 'dm329_technical_data', equipment_data,
       '20260804000000_normalize_equipment_model_pressure'
FROM dm329_technical_data WHERE id IN (
  '45deaec6-a414-473a-826d-619d0cb95149',
  '6b6d1ea6-e29a-4c85-aa96-280716a5f4e8',
  '88cfbec3-5a33-42a7-a45b-9d43911d1909'
);

-- Catalogo: nome ripulito, pressione di esercizio negli specs, chiave generica rimossa.
UPDATE equipment_catalog SET modello = 'SK 25 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = '00a2a6be-17a2-4994-b63b-e0eb5fcf7c92';
UPDATE equipment_catalog SET modello = 'ASD 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '01716273-8f15-4633-9f67-fa476b5078ab';
UPDATE equipment_catalog SET modello = 'SM 9',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '01844c9b-2192-46eb-bf84-9565055725fe';
UPDATE equipment_catalog SET modello = 'ASD 32',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '01d88bfc-e58c-40f3-a76a-840fe1ddcd06';
UPDATE equipment_catalog SET modello = 'SK 22 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = '0229dd88-2fc5-4b16-8d69-b313fdc31ecb';
UPDATE equipment_catalog SET modello = 'CSD 105 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '0294a015-f134-4fac-83d8-ee1a82877a69';
UPDATE equipment_catalog SET modello = 'CSA 20+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '02e02cfc-6db4-4bae-95db-b2edab3101a0';
UPDATE equipment_catalog SET modello = 'CSA 10+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '03a22e77-79a1-4cb1-bf63-d6c130b3dc1e';
UPDATE equipment_catalog SET modello = 'TA15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'ptar', 8)
WHERE id = '03b57b87-13e3-4ae5-8898-1b259512de0b';
UPDATE equipment_catalog SET modello = 'DSD 141',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 9, 'pressione_max', 9)
WHERE id = '03daef4f-8c13-4771-85e6-4c1d9eb6c081';
UPDATE equipment_catalog SET modello = 'AIRCENTER 12',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '057f25fc-8306-4076-a3ac-32c50b2bb250';
UPDATE equipment_catalog SET modello = 'BSD 75',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '0624feb2-55b8-4f95-90a0-b1e3f7fbbe1b';
UPDATE equipment_catalog SET modello = 'DSD 201',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '063105da-005e-40d0-98a0-f125662b8138';
UPDATE equipment_catalog SET modello = 'SX 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '06c78596-4d98-40da-8505-2de3cc19537d';
UPDATE equipment_catalog SET modello = 'DRD 100 IVR PM',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12.5, 'pressione_max', 12.5)
WHERE id = '06f7c191-a31a-4716-9b8f-3223e3c84034';
UPDATE equipment_catalog SET modello = 'SM 9',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '073903db-3e0c-43ef-b2ae-c98152b75415';
UPDATE equipment_catalog SET modello = 'CSC 100',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '0749ef0b-cb23-4d20-9539-40f8ef061c0a';
UPDATE equipment_catalog SET modello = 'BSD 72',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '077711bb-47dd-4c0d-b158-73deafa6c3f2';
UPDATE equipment_catalog SET modello = 'SM 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '08100905-77d6-4d10-b7aa-69a47915a923';
UPDATE equipment_catalog SET modello = 'DRD 75 IVR PM',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7, 'pressione_max', 7)
WHERE id = '08145ae0-1a05-46c1-ac80-2fc2829069f5';
UPDATE equipment_catalog SET modello = 'DRD 60 IVR PM',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 9.5, 'pressione_max', 9.5)
WHERE id = '095d2092-f11e-45aa-b516-c0e15d691cf0';
UPDATE equipment_catalog SET modello = 'BSD 62',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '09e69b77-4ae1-469f-ace0-0c61f09264c4';
UPDATE equipment_catalog SET modello = 'SM 16 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '09f96850-3608-4e6f-a8cf-8c56b00c4e62';
UPDATE equipment_catalog SET modello = 'CSDX 165',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '0afc2b55-15db-47d0-ad4e-415c9a979c67';
UPDATE equipment_catalog SET modello = 'TW1',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 14, 'ptar', 14)
WHERE id = '0c26b19d-1699-4d1c-a141-43a2ba922a46';
UPDATE equipment_catalog SET modello = 'SXC 3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '0c7e2f21-8d09-4c55-8aeb-80f1fa2622f8';
UPDATE equipment_catalog SET modello = 'ASK 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '0cad2fd8-28a1-4eff-9eac-5a501abdf797';
UPDATE equipment_catalog SET modello = 'SK 22',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '0d3711b7-9a45-42d6-bd7a-24fdc464ae3e';
UPDATE equipment_catalog SET modello = 'SK 25 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '0d50ef3b-a6e3-42c7-a9da-6d25f4a20837';
UPDATE equipment_catalog SET modello = 'SVW 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.5, 'ptar', 11.5)
WHERE id = '0d77d2e4-c338-4a85-a0a0-5fe2ba2d0c24';
UPDATE equipment_catalog SET modello = 'SK 25',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '0d93b918-5f53-44df-8566-ee8c40b0c187';
UPDATE equipment_catalog SET modello = 'ASD 50',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '0de4e570-fd12-4ae3-a752-7b38b4585a29';
UPDATE equipment_catalog SET modello = 'ASK 40 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '0e6a2b9a-5102-4927-af08-bfdcceb48d70';
UPDATE equipment_catalog SET modello = 'ASK 32',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '0efeaa0a-48da-46c5-8a02-acc2a61ccef7';
UPDATE equipment_catalog SET modello = 'ASK 35',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '0f9c3a0f-4087-4d7e-b176-3bbea7355b19';
UPDATE equipment_catalog SET modello = 'ASK 40 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '106fc3d1-625d-48e8-a3ed-1644ed190680';
UPDATE equipment_catalog SET modello = '810sGK (DN10)',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 14, 'ptar', 14)
WHERE id = '107d3eea-e15f-46a3-aa8b-4141ac50554f';
UPDATE equipment_catalog SET modello = 'AIRTOWER 19',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '10e297c1-237c-4633-ab45-6f9b8b9e0805';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.5, 'ptar', 11.5)
WHERE id = '1121cf36-a617-4f3f-95e5-8adc6f5649f6';
UPDATE equipment_catalog SET modello = '810sGK (DN15)',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = '115170a3-8507-480e-a77e-95954ce509b8';
UPDATE equipment_catalog SET modello = 'SK 21 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '11a3a51b-722b-44e1-a54f-b9a507c9d9db';
UPDATE equipment_catalog SET modello = 'Rollair RLS 1500 B',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = '11c7da06-5554-4180-9577-9cf0535ed4cb';
UPDATE equipment_catalog SET modello = 'DSD 141',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '12a76a32-4706-4edd-a760-35dc2528a573';
UPDATE equipment_catalog SET modello = 'ASK 32 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '12fcdb78-49a2-46dc-8926-6802bd025f82';
UPDATE equipment_catalog SET modello = 'SX 3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '1428300a-08fb-4811-a9d3-86a09988cf28';
UPDATE equipment_catalog SET modello = 'DSD 202 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '14b0a916-36fb-4193-85f6-7c64bd181825';
UPDATE equipment_catalog SET modello = 'CSA 15 IVR+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '16bc1568-0b74-4e35-91c2-d5ef3d2e23e9';
UPDATE equipment_catalog SET modello = 'SK 24',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '16c3c1df-cd82-4686-80b0-b7ea98dbaeee';
UPDATE equipment_catalog SET modello = 'CSDX 165 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = '16fda4fe-4ce6-49e2-bf1d-3c8e4cc7d418';
UPDATE equipment_catalog SET modello = 'ASD 50 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '17e53463-0456-475c-b49a-9f0ec8d6ab47';
UPDATE equipment_catalog SET modello = 'AIRTOWER 11',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '1803277b-d04e-48dd-8391-892f22162010';
UPDATE equipment_catalog SET modello = 'AIRTOWER 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '18bc76c8-a44b-4d5e-b96c-1fcdc02fd19b';
UPDATE equipment_catalog SET modello = 'AIRCENTER 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '194734ce-8755-4462-b9ac-32eb7f5ad13b';
UPDATE equipment_catalog SET modello = 'AIRCENTER 22',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '19d5cbbe-a974-41a2-a953-350b974533cb';
UPDATE equipment_catalog SET modello = 'Rollair RLS 1500 AE4',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '19f0b9c9-7b73-4dbe-86eb-dacd2d76ec72';
UPDATE equipment_catalog SET modello = 'TA15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'ptar', 11)
WHERE id = '1b400974-b8d6-4fb9-bda5-d15d41adc163';
UPDATE equipment_catalog SET modello = 'CSA 15+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '1b43bc06-fe48-4d2c-95ba-21311ee169cc';
UPDATE equipment_catalog SET modello = 'ASK 40 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '1b5ce261-3e2e-46bf-ac73-a28b27dd8fca';
UPDATE equipment_catalog SET modello = 'SX 4',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '1ba66f49-af13-41d6-9fe6-8230a6d77294';
UPDATE equipment_catalog SET modello = 'CSA 10+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '1bf1a736-761f-4103-8c5a-f363cac53a1b';
UPDATE equipment_catalog SET modello = 'SM 16 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '1c0d563f-d350-435a-aff0-c6ead185c14c';
UPDATE equipment_catalog SET modello = 'ASK 40 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '1c2ff99b-c401-4dad-bf54-74060c9a49b2';
UPDATE equipment_catalog SET modello = 'ASD 40 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '1c4595bb-18a0-41c7-876e-fe0a4d9e438e';
UPDATE equipment_catalog SET modello = 'ASD 57',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = '1c62da94-a48a-4fb9-9d73-be37d75ef9e2';
UPDATE equipment_catalog SET modello = 'SK 22 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '1d89ec64-84a6-49ed-8dda-d2101ba0f746';
UPDATE equipment_catalog SET modello = 'CSD 125 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = '1dd3c886-3548-4a92-8212-3474f1fe3e94';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 21, 'ptar', 21)
WHERE id = '1dd7d74c-1b35-4240-b048-73bdcb2a5294';
UPDATE equipment_catalog SET modello = 'ASK 40 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '1eb64d09-52f9-4a49-85d5-bf4478c23baa';
UPDATE equipment_catalog SET modello = 'CSC 75',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '2052ad7d-691b-42fd-863a-c7c42ef6fe19';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 14, 'ptar', 14)
WHERE id = '20e01f92-d46e-4024-b2d9-fcace6d68aa6';
UPDATE equipment_catalog SET modello = 'SM 12 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '20ea69f5-961b-492a-80e1-49f9c1a8248f';
UPDATE equipment_catalog SET modello = 'CSA 15+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '2100e414-84f0-4928-bc5e-8a0f7505f3ba';
UPDATE equipment_catalog SET modello = 'DRD 75 IVR PM',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 9.5, 'pressione_max', 9.5)
WHERE id = '21e3ba8a-d976-4e24-8ba8-b2dba88d6f92';
UPDATE equipment_catalog SET modello = 'CSDX 140 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '220ac2bb-24e7-46d9-95f7-5dd02351861c';
UPDATE equipment_catalog SET modello = 'DSD 175',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = '220ad188-c315-405f-abe7-68eb47f0c156';
UPDATE equipment_catalog SET modello = 'SK 21 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '225d2738-8e83-439b-8aa3-fefcd50fd92f';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'ptar', 12)
WHERE id = '23884e2d-9412-407e-b7c5-8a7902e02cf3';
UPDATE equipment_catalog SET modello = 'ASD 47 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '2404e232-1fba-4304-84e7-e1b55c5206e5';
UPDATE equipment_catalog SET modello = 'CSM 7,5',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '24a2a4f2-a780-4ca2-9fa3-98af62ff7529';
UPDATE equipment_catalog SET modello = 'CSA 10 IVR+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '24dc4d7c-4d14-417f-8f30-76baf010fab2';
UPDATE equipment_catalog SET modello = 'CSA 10 IVR+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '24e6ce5e-cc17-4a44-ae01-b60c737fd386';
UPDATE equipment_catalog SET modello = 'CSD 105',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = '26d03773-fc03-48a2-87b4-4a67e3605451';
UPDATE equipment_catalog SET modello = 'CSA 15 IVR+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '273daa7c-5bcb-4cc0-844f-c25b5e994a48';
UPDATE equipment_catalog SET modello = 'DRD 100 IVR PM',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7, 'pressione_max', 7)
WHERE id = '27ea0b95-7fe4-40bc-a38f-b9205389f142';
UPDATE equipment_catalog SET modello = 'ASK 28',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '286a06b3-b259-4989-a1a6-103f5a312fd3';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = '28c2d7a5-5cb0-4dc5-a845-19c54a665391';
UPDATE equipment_catalog SET modello = 'ASD 60 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '29696848-b140-4087-9436-f2fb4459816b';
UPDATE equipment_catalog SET modello = 'SK 24',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '296eb3e6-801e-4207-86b5-28ad01b98899';
UPDATE equipment_catalog SET modello = 'CSDX 175 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '298d6205-301b-42db-8b4e-5cd9f7694ae7';
UPDATE equipment_catalog SET modello = 'SM 16',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = '29928728-5cdc-44d5-9ea6-75ca2fde0505';
UPDATE equipment_catalog SET modello = 'BSD 81',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '2a28c12e-1443-4076-a6e4-e5f5d6b2dc2c';
UPDATE equipment_catalog SET modello = 'CSB 30 IVR',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '2a61f073-f4f0-4045-a3cb-a7ac5be99d87';
UPDATE equipment_catalog SET modello = 'CSA 20+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '2a9a6bcf-6412-48e4-ae57-de7db6367419';
UPDATE equipment_catalog SET modello = 'SK 24 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '2ac5455d-f6bf-4b33-b73f-d1219923429c';
UPDATE equipment_catalog SET modello = 'CSM 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '2acd1cd8-37db-45ec-8c32-2db318e79747';
UPDATE equipment_catalog SET modello = 'CSA 10 IVR+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '2b94bdff-ccaa-4746-9fc1-c5b71d062826';
UPDATE equipment_catalog SET modello = 'DRD 60 IVR PM',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12.5, 'pressione_max', 12.5)
WHERE id = '2ba63588-7446-4646-84ce-b4c6b89493d6';
UPDATE equipment_catalog SET modello = 'ASD 37',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8.5)
WHERE id = '2c867d19-ce40-4ca6-b1fb-ee8e85242e63';
UPDATE equipment_catalog SET modello = 'Rollair RLR 1000 B',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '2da7d9fa-474d-4153-ae52-973420280a08';
UPDATE equipment_catalog SET modello = 'AIRCENTER 22',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '2e40294b-7729-49e0-8030-bfeea330502c';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'ptar', 11)
WHERE id = '2e450c61-7dcc-4f92-acdc-bf26c6e7d69f';
UPDATE equipment_catalog SET modello = 'SM 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '2e7a89f0-251a-4c58-8bce-664294556648';
UPDATE equipment_catalog SET modello = 'ASD 60 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '2f268c00-e85c-45ca-817d-df9155a7d392';
UPDATE equipment_catalog SET modello = 'CSDX 137',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '2f484e76-a459-4e7f-9515-285cbd28dba5';
UPDATE equipment_catalog SET modello = 'ASK 28 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '2f53156a-a3b2-4a54-a54e-86868ef516d2';
UPDATE equipment_catalog SET modello = 'AIRCENTER 12 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '2fe81a00-b3be-4ca4-9675-7cd1021aa598';
UPDATE equipment_catalog SET modello = 'AS 36',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '3023501b-6fd6-4e8f-86df-7cdf8667d168';
UPDATE equipment_catalog SET modello = 'CSD 82',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.25)
WHERE id = '3068c000-dd5a-4592-a276-61ca336e6cb6';
UPDATE equipment_catalog SET modello = 'S15N',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'ptar', 12)
WHERE id = '3093c45b-4109-4722-b45b-619f09ce4f0d';
UPDATE equipment_catalog SET modello = 'ASK 34 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '30b2e8af-e049-407f-b178-35cfbb5f0644';
UPDATE equipment_catalog SET modello = 'SK 26',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '30ccc3d3-aff1-4187-9228-4e4229e3a9e4';
UPDATE equipment_catalog SET modello = 'SM 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '30d903a5-7096-4ae6-be62-214079f088f0';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15.5, 'ptar', 15.5)
WHERE id = '30fce141-62b3-42d5-8728-731407f88912';
UPDATE equipment_catalog SET modello = 'ASK 34 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '31326495-5b37-491b-81ef-481e4d0d4c54';
UPDATE equipment_catalog SET modello = 'CSC 100',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '3159163f-8322-4912-a3bb-776278b62a0c';
UPDATE equipment_catalog SET modello = 'BVC 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '317efd0f-1503-4b14-b9f5-55783fd32d12';
UPDATE equipment_catalog SET modello = 'SXC 4',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '31f6a3f9-288f-4257-8030-a9ae3acbe64f';
UPDATE equipment_catalog SET modello = 'SK 21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '322e5f33-5b0a-4713-bec9-a269b3b130bf';
UPDATE equipment_catalog SET modello = 'CSA 15 IVR',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '32720cd2-2729-4fdf-afd1-0d2103812a9c';
UPDATE equipment_catalog SET modello = 'DSD 201',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '33ad2a53-8de9-4acf-a310-4c2cda2ed1d9';
UPDATE equipment_catalog SET modello = 'SM 9',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '3415442c-661c-4f91-96ce-d4d8c8780a4f';
UPDATE equipment_catalog SET modello = 'ASD 60',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '342fcd9f-6256-48cc-8738-4e83bc5245a0';
UPDATE equipment_catalog SET modello = 'SK 22 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '34e9c507-a645-4bba-9af4-9427f8a1e110';
UPDATE equipment_catalog SET modello = 'CSD 102 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '34f02f2d-5577-424a-af29-ef79b3e96f85';
UPDATE equipment_catalog SET modello = 'ASK 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '34f2a539-a45a-4f4b-ace2-fa1b80ec2a3f';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 16, 'ptar', 16)
WHERE id = '3599a72d-2d30-433e-9836-d4ea7134b7b5';
UPDATE equipment_catalog SET modello = 'CSD 125 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '3636eda9-d13c-4ef2-bc17-8c19516bdc44';
UPDATE equipment_catalog SET modello = 'BSD 75 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '37087169-3e95-4609-a9f7-1a9f0292c9df';
UPDATE equipment_catalog SET modello = 'ASD 47',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '37210f2e-729e-4b67-afb1-334e5d305710';
UPDATE equipment_catalog SET modello = 'SK 22 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '3730a714-cab8-47e9-86c2-69d561bc360e';
UPDATE equipment_catalog SET modello = 'AIRTOWER 19',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = '376bd4c2-ec27-4654-9720-22ba250bdb0c';
UPDATE equipment_catalog SET modello = 'SVW 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.5, 'ptar', 11.5)
WHERE id = '38395fba-7d84-4c8b-b846-262ac598ef6b';
UPDATE equipment_catalog SET modello = 'CSD 125',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '38db7dd5-acbc-4be8-83b0-e1de31bbb4ee';
UPDATE equipment_catalog SET modello = 'CSA 5,5',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '3921517e-f48a-49ad-a090-5c5060bcdc78';
UPDATE equipment_catalog SET modello = 'CSA 7,5',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '3a38679e-6482-4cf1-b5f5-c3fdb73c3b52';
UPDATE equipment_catalog SET modello = 'SVW 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = '3a73706f-1e85-42e7-b459-f75d7c3b309f';
UPDATE equipment_catalog SET modello = 'GA 18',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '3ac486e2-94fc-47c4-81db-c206ac92cae4';
UPDATE equipment_catalog SET modello = 'P20',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.5, 'ptar', 11.5)
WHERE id = '3ad84845-830e-4a0c-8f7d-ba82519aac6c';
UPDATE equipment_catalog SET modello = 'S32N',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10.8, 'ptar', 10.8)
WHERE id = '3afeb4c7-ffdc-4548-bbbf-f001777883e2';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 9.5, 'ptar', 9.5)
WHERE id = '3bfe86ef-f10d-4276-96ab-0f89b67a8cb7';
UPDATE equipment_catalog SET modello = 'AIRTOWER 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '3ca39fcf-1e8b-452b-a9ff-69fac78915ef';
UPDATE equipment_catalog SET modello = 'AIRCENTER 22',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '3cdd1ddb-beac-4c58-b141-be13579bf8f6';
UPDATE equipment_catalog SET modello = 'ASD 50 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 13)
WHERE id = '3ce5ad48-473f-4df5-a128-792a542c0791';
UPDATE equipment_catalog SET modello = 'CSA 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '3dd65c69-6ee0-4977-8471-9b90730365e5';
UPDATE equipment_catalog SET modello = 'ASD 47',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = '3de73bb4-b4af-41b4-9058-079341239edc';
UPDATE equipment_catalog SET modello = 'ASK 28',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '3ee6a692-a5c1-4fcc-9a87-503f7ea5fa38';
UPDATE equipment_catalog SET modello = 'AIRTOWER 3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = '3f4d6c56-f00d-47a2-abfc-03afd81da8f1';
UPDATE equipment_catalog SET modello = 'SM 9T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '404e0e68-ad80-4c0d-a070-e76488b0da9a';
UPDATE equipment_catalog SET modello = 'CSDX 137',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '41ca1f11-5fc0-4943-8d83-3acafc237370';
UPDATE equipment_catalog SET modello = 'BSD 72 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '4266d423-b428-4a2b-8a3a-3009b748e9e3';
UPDATE equipment_catalog SET modello = 'AIRCENTER 13 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '428cab2f-b379-4f2c-acfc-c2f2a9eac9f5';
UPDATE equipment_catalog SET modello = 'SXC 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '4345f30b-504d-45fa-beb0-cebb7f0ace15';
UPDATE equipment_catalog SET modello = 'S25N',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10.8, 'ptar', 10.8)
WHERE id = '4352ba92-7762-48ea-86e2-9042f8b7b072';
UPDATE equipment_catalog SET modello = 'ASK 32 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '43c8fab9-4b1e-4ca3-a36c-43779d8eb944';
UPDATE equipment_catalog SET modello = 'GA 11 C',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '441ef1db-953f-41c4-9ac9-11ae7677b6fa';
UPDATE equipment_catalog SET modello = 'AIRCENTER 22 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '451aca9d-6409-4e5f-be88-1f16207d54b5';
UPDATE equipment_catalog SET modello = 'BSD 81',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '45bf2b6a-436e-4662-b659-d5819f8b2712';
UPDATE equipment_catalog SET modello = 'CSD 90 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '45cce7e9-df3b-4be5-99a4-943f15c00c19';
UPDATE equipment_catalog SET modello = 'BSD 75 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '462f12a8-47c1-41f0-82db-0f5a1f2ca245';
UPDATE equipment_catalog SET modello = 'BSD 83',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '4668851e-8260-454f-984d-562106117ca6';
UPDATE equipment_catalog SET modello = 'ASK 35',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '466effa8-7ee2-4491-b68e-0810a446e711';
UPDATE equipment_catalog SET modello = 'SM 9T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '46c95f86-f19f-4ba3-a173-92e42a3bc2cb';
UPDATE equipment_catalog SET modello = 'GA 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '46d4d673-68c9-409e-89c1-eace16d35172';
UPDATE equipment_catalog SET modello = 'SK 21 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '47496d90-8c9e-4c44-9204-de7776e992d8';
UPDATE equipment_catalog SET modello = 'CSA 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '4750c720-cb90-4f3c-8bfb-c88318e84def';
UPDATE equipment_catalog SET modello = 'S25N',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.5, 'ptar', 11.5)
WHERE id = '477550a2-80be-4245-8f25-79678d7cd064';
UPDATE equipment_catalog SET modello = 'TA15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'ptar', 12)
WHERE id = '47b83d68-b788-4bf2-a4fd-6d9b0f38c5ea';
UPDATE equipment_catalog SET modello = 'CSM 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '47f8b0c1-bb08-4245-8143-f42072ac8c86';
UPDATE equipment_catalog SET modello = 'AIRTOWER 6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = '480df2e9-4981-4dc3-ad29-7742762c7bdd';
UPDATE equipment_catalog SET modello = 'SM 16',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '48a93205-8079-4d9a-a75a-c3b6041685f4';
UPDATE equipment_catalog SET modello = 'CSB 30 IVR',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '48b1cebe-ea97-42dd-92e9-09d9f33f76cb';
UPDATE equipment_catalog SET modello = 'ASK 34 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '49040e5a-d256-4cc2-90c0-1ed0eeb034ce';
UPDATE equipment_catalog SET modello = 'ASD 35',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '496faa65-b1ee-492f-ad67-96f6471923aa';
UPDATE equipment_catalog SET modello = 'ASD 40 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '49e1ee4e-6946-435e-a04e-47c9c7e91eee';
UPDATE equipment_catalog SET modello = 'ASK 28 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '4a342914-2f66-405d-859a-2a891c2df4cd';
UPDATE equipment_catalog SET modello = 'TVW 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.5, 'ptar', 11.5)
WHERE id = '4a40ec02-3372-475a-855b-7632d801750a';
UPDATE equipment_catalog SET modello = 'SK 22 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '4aa5464b-3098-4855-976a-e064db7a639f';
UPDATE equipment_catalog SET modello = 'TA6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'ptar', 11)
WHERE id = '4ac996ce-1d97-49e2-a76b-85b571acdda4';
UPDATE equipment_catalog SET modello = 'ASD 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '4ae40153-b306-418a-8e7b-a38adae42e89';
UPDATE equipment_catalog SET modello = 'SM 13T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '4c3d9597-b0c0-497e-b617-46ee871b32b6';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'ptar', 12)
WHERE id = '4c626033-c68b-4415-8fde-2593a8e8ee88';
UPDATE equipment_catalog SET modello = 'BSD 62',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '4ca435c8-b4e6-40f2-bb13-9cca1f663366';
UPDATE equipment_catalog SET modello = 'SK 25 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '4d7c7376-f9c8-4e8c-88c1-40cc25e8c0e9';
UPDATE equipment_catalog SET modello = 'ASD 50',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '4dc95c20-0a97-40ed-824b-87e29eb9a948';
UPDATE equipment_catalog SET modello = 'SK 24 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '4e1cf704-fd27-4bfc-903f-76027913384f';
UPDATE equipment_catalog SET modello = 'ASK 34',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '4e6a30bf-45b5-4961-a7e0-43b503f88acc';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.2, 'ptar', 11.2)
WHERE id = '4fab123a-6580-4dad-b684-b3c5edef939b';
UPDATE equipment_catalog SET modello = 'SM 15T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '50873f0c-9e6a-49f2-bbaa-52e14028111d';
UPDATE equipment_catalog SET modello = 'ASK 32 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '51116be7-d2e6-4bde-925a-16ac2f056075';
UPDATE equipment_catalog SET modello = 'ASK 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '516f459f-7478-4baf-9644-33a7bbc1d747';
UPDATE equipment_catalog SET modello = 'ASD 60',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = '521cd950-9b6a-476b-80b7-e91f641db0e4';
UPDATE equipment_catalog SET modello = 'TW1',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'ptar', 15)
WHERE id = '5234853e-a73c-4610-aebb-a579358ade41';
UPDATE equipment_catalog SET modello = 'ASD 60 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '5264a171-ba86-441f-8453-913ca31682ca';
UPDATE equipment_catalog SET modello = 'CSDX 140 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '53d3f112-037d-4fc2-8a19-76659d481d4e';
UPDATE equipment_catalog SET modello = 'SM 13 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '53fcead2-470b-40ee-be4d-001c5dfbffb7';
UPDATE equipment_catalog SET modello = 'CSDX 165 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '5533c970-d9a9-40e7-bb45-8b7bb859b6d9';
UPDATE equipment_catalog SET modello = 'AIRCENTER 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 15)
WHERE id = '55d0947d-82b7-4534-8089-9e58703a0db5';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 45, 'ptar', 45)
WHERE id = '567aa4c2-6711-494d-b4d6-e08c22da3d0c';
UPDATE equipment_catalog SET modello = 'CSDX 140',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '5781635a-0c69-43f8-ab2f-9cd01f5d3a26';
UPDATE equipment_catalog SET modello = 'ASK 34 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '57ffef0e-301e-4805-b94c-fb83df0bdbd7';
UPDATE equipment_catalog SET modello = 'SM 13 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '58004438-56a9-4dc7-bbb6-6291a77ca164';
UPDATE equipment_catalog SET modello = 'CSA 20',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '5900e0a8-120b-465b-b8ba-9ef9c671e42b';
UPDATE equipment_catalog SET modello = 'AIRCENTER 16',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '597d2c85-5b2e-4954-a3f6-bf75e12f52aa';
UPDATE equipment_catalog SET modello = 'TW1',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'ptar', 12)
WHERE id = '5c12eeee-41f8-4e69-ade5-3b40c9c57963';
UPDATE equipment_catalog SET modello = 'SK 21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '5c3a5dfb-a2ee-4039-b54d-6b2244fba836';
UPDATE equipment_catalog SET modello = 'ASK 27 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '5e0ecaea-19b0-4327-9634-cbffaf49f670';
UPDATE equipment_catalog SET modello = 'CSM 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '5e4f6f23-d3e3-4b4e-8306-ba7a263236e7';
UPDATE equipment_catalog SET modello = 'BSD 81',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '5e919749-695b-4709-8a37-6b8491fa0391';
UPDATE equipment_catalog SET modello = 'SK 22 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '5eb88171-1ce7-44da-9886-70325c46e0ff';
UPDATE equipment_catalog SET modello = 'CSA 20 IVR+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '5ef5dc07-e86d-4a35-b2f7-0e2fb2de8a62';
UPDATE equipment_catalog SET modello = 'SM 12T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '60ddc0e1-0874-4380-9b16-42ce0316bd63';
UPDATE equipment_catalog SET modello = '810sGK (DN10)',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = '622a0d3d-f731-4b6d-9a3f-4ef4b60fc165';
UPDATE equipment_catalog SET modello = 'SX 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '6242dd62-b176-4b97-8cb4-97f089e53048';
UPDATE equipment_catalog SET modello = 'SXC 6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '63709efb-469b-470c-a153-92deee7dd22b';
UPDATE equipment_catalog SET modello = 'CSA 7,5+TANK270+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '63d7b2c3-752c-480e-a516-80bf20146ac6';
UPDATE equipment_catalog SET modello = 'CSA 20+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '640c1e79-8f5d-48c4-af54-54b64965008e';
UPDATE equipment_catalog SET modello = 'BSD 72 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '64a7d990-baad-405d-bc29-c5cc8f349500';
UPDATE equipment_catalog SET modello = 'CSDX 140',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '66ce9955-df11-4608-842f-727c3a34ff36';
UPDATE equipment_catalog SET modello = 'AIRTOWER 11',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '67038192-18b5-4250-ade9-b66e7b36f021';
UPDATE equipment_catalog SET modello = 'AS 36',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8.5)
WHERE id = '68528db2-8fa7-4b68-b162-8ac807e3f35e';
UPDATE equipment_catalog SET modello = 'CSA 7,5+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '685b4931-922b-4ef9-9a3d-d1469db3cb2a';
UPDATE equipment_catalog SET modello = 'SVW 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = '68af0489-5319-4c32-8471-dde77db5b572';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15.5, 'ptar', 15.5)
WHERE id = '68dedd24-4f43-431b-8a51-89cd655c55db';
UPDATE equipment_catalog SET modello = 'S25N',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.4, 'ptar', 11.4)
WHERE id = '6a11dff8-476f-4c1e-84d1-c955bbd0bb29';
UPDATE equipment_catalog SET modello = 'ASK 27',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '6a503cba-bc45-4031-b1fc-b69432a009fb';
UPDATE equipment_catalog SET modello = 'AIRCENTER 16',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '6c3aeb85-144f-4e7c-9b85-ce4abb1b4e02';
UPDATE equipment_catalog SET modello = 'ASD 60 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '6d790df7-7617-4972-b3cd-af271d25238a';
UPDATE equipment_catalog SET modello = 'TA15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 16, 'ptar', 16)
WHERE id = '6dec94ab-6c01-43c9-888d-6f6115611bd2';
UPDATE equipment_catalog SET modello = 'CSC 75',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '6e3c2e1c-a41e-495c-a03a-fd5da8c6b2c0';
UPDATE equipment_catalog SET modello = 'SM 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '6fcaffdc-5fc9-45b7-933a-d8a5c8789191';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.44, 'ptar', 11.44)
WHERE id = '6fea5635-7081-40f3-a518-bc3f2069cab0';
UPDATE equipment_catalog SET modello = 'TW1',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'ptar', 11)
WHERE id = '703e8d5b-2a89-40d6-adf4-934727740ee0';
UPDATE equipment_catalog SET modello = 'CSD 105',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '703fe8ec-ad62-4d45-ac43-e6c05798410c';
UPDATE equipment_catalog SET modello = 'CSA 20+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '70797442-e2bf-4372-ae4f-3e04f4368384';
UPDATE equipment_catalog SET modello = 'TA15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.44, 'ptar', 11.44)
WHERE id = '70d514d5-e1e0-4059-83bf-1dd418b32dc9';
UPDATE equipment_catalog SET modello = 'ASD 40 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '70f4086e-8222-43b3-bd2d-dda704b81241';
UPDATE equipment_catalog SET modello = 'Rollair RLS 60',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8.5)
WHERE id = '71ddec40-7d47-478e-8465-cda79d49a38e';
UPDATE equipment_catalog SET modello = 'ASD 37 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 15)
WHERE id = '7328440f-c102-47d0-aec6-86b6c33d8894';
UPDATE equipment_catalog SET modello = 'SK 21 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '733a166a-ebce-41ed-901d-986aa7ada869';
UPDATE equipment_catalog SET modello = 'CSA 7,5',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '735dd379-3d93-4c4c-8ac4-5542a174fd77';
UPDATE equipment_catalog SET modello = 'CSA 20 IVR+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '73f58e04-8c76-4edd-acf2-7cefcf6e4d99';
UPDATE equipment_catalog SET modello = 'SM 12',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '7400b022-edc3-4657-bab3-6df6bf9242cd';
UPDATE equipment_catalog SET modello = 'GA 45 VSD',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '744ca78e-904a-4247-ae39-0c74c6d7b659';
UPDATE equipment_catalog SET modello = 'GA 45 VSD',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7, 'pressione_max', 7)
WHERE id = '74a51a5d-f532-41a2-8982-c774337d6ec3';
UPDATE equipment_catalog SET modello = 'GA 22',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '74b4609b-5c23-412c-8f56-44d11980debb';
UPDATE equipment_catalog SET modello = 'CS 76',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '74c1395d-0bd1-4b3c-b60c-989fb6d66149';
UPDATE equipment_catalog SET modello = 'CSDX 165',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '754dcc72-6a65-4e7a-9ea9-d2743530735b';
UPDATE equipment_catalog SET modello = 'AIRTOWER 19',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '75edcd1b-8eeb-4bf2-8409-7977ffe4eba3';
UPDATE equipment_catalog SET modello = 'CSD 105 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '77b0eeba-153c-4467-9a9c-00cddd71619f';
UPDATE equipment_catalog SET modello = 'ASD 47 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '78593f15-b490-4cd0-94e1-f26c8456e01a';
UPDATE equipment_catalog SET modello = 'CSA 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '787f3951-69c9-43c1-89ad-f6fbab0c25c1';
UPDATE equipment_catalog SET modello = 'CSA 15 IVR+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '79b19889-1256-43ef-bd26-cd72ab586c86';
UPDATE equipment_catalog SET modello = 'CSD 110',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '7ad2825d-f6a0-4de0-ab73-79506d5dafad';
UPDATE equipment_catalog SET modello = 'DSD 205',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '7ada3cf3-6ffb-4674-801c-7882bd01d185';
UPDATE equipment_catalog SET modello = 'SXC 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '7af187d7-ada6-490c-a028-b43dd06f43f5';
UPDATE equipment_catalog SET modello = 'S32N',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.4, 'ptar', 11.4)
WHERE id = '7b570bc5-7ebf-4e4e-922c-a1c67541c35f';
UPDATE equipment_catalog SET modello = 'SK 25 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '7bfe3405-c83c-45b0-9f84-b4e69e642582';
UPDATE equipment_catalog SET modello = '810sGK (DN25)',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = '7c750c4c-de07-4c12-85fa-3fe500bffc71';
UPDATE equipment_catalog SET modello = 'CS 91',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = '7d2f6da0-2427-4fa5-842e-3d5cb17c43ff';
UPDATE equipment_catalog SET modello = 'AIRCENTER 12',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 15)
WHERE id = '7ece58ec-9232-4c58-a95e-70a3fb2e9149';
UPDATE equipment_catalog SET modello = 'BSD 65',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '7f0ba217-04b0-4d03-b777-0a184423cb46';
UPDATE equipment_catalog SET modello = 'AIRCENTER 22 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '7fefc066-f760-49a4-b58d-8f8146751276';
UPDATE equipment_catalog SET modello = 'ASD 50 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '8005d1b0-bb3e-4aba-8e8a-e21d708aff11';
UPDATE equipment_catalog SET modello = 'ASD 47',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '8113adf7-c206-4eed-8bc6-3711f1de534d';
UPDATE equipment_catalog SET modello = 'SM 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '81552657-c237-412d-a737-9c08fecb8df0';
UPDATE equipment_catalog SET modello = 'DSD 241',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '82a1e357-7f89-4e92-b327-459f021fc8c0';
UPDATE equipment_catalog SET modello = 'SK 25',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '838c09ce-5116-409b-9999-7bf7db3dd33f';
UPDATE equipment_catalog SET modello = 'SK 21 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '845cf0a1-f4cc-4855-8295-451988b8c745';
UPDATE equipment_catalog SET modello = 'ASK 34',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '8526a443-ffe3-4856-828f-8a6a26488ece';
UPDATE equipment_catalog SET modello = 'BSD 75',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '85792533-3dea-4cf5-9127-f7d20e1fb60b';
UPDATE equipment_catalog SET modello = 'AIRCENTER 25 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '8608d5d6-d1ed-4a57-8d84-23455f154b08';
UPDATE equipment_catalog SET modello = 'CSC 50',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '86b83f16-bb18-43a8-9664-0e1cc50890c3';
UPDATE equipment_catalog SET modello = 'AIRCENTER 22 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '87452e6f-3df9-470d-8765-70ebdad1b120';
UPDATE equipment_catalog SET modello = 'CSA 10+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = '883ab675-ef21-4929-9c37-9ca9ffeebb4f';
UPDATE equipment_catalog SET modello = 'AIRTOWER 4',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = '88978eeb-38b8-4009-8e7d-81bba598c8ee';
UPDATE equipment_catalog SET modello = 'CSC 50',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '889cd30a-d593-40cd-9853-d11f2194b365';
UPDATE equipment_catalog SET modello = 'DSD 241',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = '88cff4f7-791d-4e2a-9a67-ed50bfeda8c5';
UPDATE equipment_catalog SET modello = '810sGK (DN20)',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = '88e13def-fccf-4055-a328-3b49d037e2d9';
UPDATE equipment_catalog SET modello = 'CSD 125 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = '89ea826f-bbc0-4cf2-9074-f5e49a904441';
UPDATE equipment_catalog SET modello = 'CSD 85 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '89ef9c44-688c-4b7c-b703-3fe7ea24dd0c';
UPDATE equipment_catalog SET modello = 'ASK 40 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '89f628f4-30aa-4a3b-8245-e7049a11bde8';
UPDATE equipment_catalog SET modello = 'DSD 141',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = '8a09ae41-07de-4f5e-b0be-1afe9c3e092a';
UPDATE equipment_catalog SET modello = 'CSC 100',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '8a4164e9-f95d-4e0c-8e11-a31a19f2de00';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10.5, 'ptar', 10.5)
WHERE id = '8c712f81-c73b-4c32-a77e-22dde49856e6';
UPDATE equipment_catalog SET modello = 'SK 19',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 11)
WHERE id = '8c79fbbb-337d-43bd-8e40-eca194063146';
UPDATE equipment_catalog SET modello = 'TW1',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13.5, 'ptar', 13.5)
WHERE id = '8c92f3fa-d295-4b6b-9811-a5c2eaa366d9';
UPDATE equipment_catalog SET modello = 'CSA 20 IVR',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '8cbfaf30-0a6a-48f5-b054-c716e2332c03';
UPDATE equipment_catalog SET modello = 'ASK 27',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '8cca3cec-a403-44fd-95bc-76c3d0090ac1';
UPDATE equipment_catalog SET modello = 'DS 140',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = '8d0173c6-4c23-4083-9f36-0555db3799a4';
UPDATE equipment_catalog SET modello = 'AIRCENTER 25',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '8e0ffa20-25e8-4f48-b487-26117878dcdd';
UPDATE equipment_catalog SET modello = 'CSD 125',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '8f32c08e-d08b-425a-8b3d-006365faa699';
UPDATE equipment_catalog SET modello = 'ASD 57',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '8f55e71d-d90c-47a8-9dda-db4df1992bb2';
UPDATE equipment_catalog SET modello = 'SM 13',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '8f9ea648-4901-4c39-9944-ef0347c7a583';
UPDATE equipment_catalog SET modello = 'SX 4',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '8fe57c75-f169-4bd6-a797-ba7a5a9e9520';
UPDATE equipment_catalog SET modello = 'AIRTOWER 6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '9129b4ab-ea7c-439c-bdee-ee673ec8394e';
UPDATE equipment_catalog SET modello = 'BSD 83',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '91af4dc3-40b0-4427-a3b7-f4afccccb042';
UPDATE equipment_catalog SET modello = 'AIRCENTER 12 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 15)
WHERE id = '9238a4ab-0603-4df0-88bb-f91167e8ba0e';
UPDATE equipment_catalog SET modello = '810sGK (DN15)',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 14, 'ptar', 14)
WHERE id = '92e718ac-200b-4d1f-9b7d-419e8e4a52e6';
UPDATE equipment_catalog SET modello = 'SK 24 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '93008b78-f241-4e29-9190-9daedaae6114';
UPDATE equipment_catalog SET modello = 'TA7',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'ptar', 11)
WHERE id = '93766ac2-a571-4be0-b31d-ae22502e5c36';
UPDATE equipment_catalog SET modello = 'ASK 35',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '9394431f-af65-4888-8c8e-3de1d8e0b53d';
UPDATE equipment_catalog SET modello = 'CSC 60',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '93e6dd64-9129-4cd4-a2bd-c4005a38e0fc';
UPDATE equipment_catalog SET modello = 'CSC 60',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '940b1eee-4a47-4af0-babd-4b19f1f8fa23';
UPDATE equipment_catalog SET modello = 'CSA 10+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '9415e0fa-9b2c-41c3-8767-e3f9eae5c9d5';
UPDATE equipment_catalog SET modello = 'CSD 85',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '94631a6c-8492-4e31-953c-b6764558fef3';
UPDATE equipment_catalog SET modello = 'ASD 37 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '9467d8f2-4437-4c9e-9556-92072db9893a';
UPDATE equipment_catalog SET modello = 'CSA 20 IVR',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '94b75626-6500-4758-8a5a-acbc7e1792bb';
UPDATE equipment_catalog SET modello = 'ASK 32 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '94bd1205-4e71-4c55-8c7b-c36b83488953';
UPDATE equipment_catalog SET modello = 'CSA 15+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '950b5275-2875-43e3-8fdc-feb52abe0ed7';
UPDATE equipment_catalog SET modello = 'SXC 4',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '950b56ec-6d94-422c-956e-9501a1383bf0';
UPDATE equipment_catalog SET modello = 'SK 19',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '958a74a0-aa19-4bf7-9893-2396fef42e3f';
UPDATE equipment_catalog SET modello = 'AIRCENTER 25',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '967e3be8-ef44-42a0-af56-0e616e5a2c72';
UPDATE equipment_catalog SET modello = 'CSA 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '96fdabe4-914e-40bf-90a3-d79f21929952';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = '97035bdd-2ab8-490c-bec7-51b043cf6986';
UPDATE equipment_catalog SET modello = 'SX 6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '98778f9a-9bd3-485d-a0eb-5f17e618817a';
UPDATE equipment_catalog SET modello = 'CSA 20',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = '9a0eb512-8aad-4e04-baeb-9fe0cc948a03';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 14, 'ptar', 14)
WHERE id = '9a5efec2-1082-49e0-8d2d-9eea9c6c6994';
UPDATE equipment_catalog SET modello = 'CSD 105',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = '9a98e16c-f3e5-4e85-8ac0-fcd0eb8477c9';
UPDATE equipment_catalog SET modello = 'CSDX 140 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = '9aa901d6-286f-44fc-88c6-5d2340534a8a';
UPDATE equipment_catalog SET modello = 'TA21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10.8, 'ptar', 10.8)
WHERE id = '9ac8ee75-bdf8-4007-8aab-825fc0630d80';
UPDATE equipment_catalog SET modello = 'CSD 85',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '9ae71ae3-9262-4bae-b041-ea874c49f0e4';
UPDATE equipment_catalog SET modello = 'H15N',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = '9b03c6b8-a350-490c-90bd-8ea97adef0b5';
UPDATE equipment_catalog SET modello = 'BSD 65',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '9b067f19-ab05-4180-b5e4-5b790f04252e';
UPDATE equipment_catalog SET modello = 'AIRCENTER 13',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '9b418e31-ba9b-4596-b57a-a50268cdb3ff';
UPDATE equipment_catalog SET modello = 'CSA 10 IVR',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '9b448769-f424-44da-a4f0-642e3921b7b6';
UPDATE equipment_catalog SET modello = 'ASD 60 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = '9b69a48b-59a1-4fe2-bf30-82fde1f8227b';
UPDATE equipment_catalog SET modello = 'CSC 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '9bd8f1a1-ac9f-4de2-ae36-79cfad72e60b';
UPDATE equipment_catalog SET modello = 'ASD 60 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = '9c6f33d3-17da-479c-8298-871eb89eb1d1';
UPDATE equipment_catalog SET modello = 'RLR 4000',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = '9df99c70-c54e-4437-bf35-ec6269573a00';
UPDATE equipment_catalog SET modello = 'CSD 102',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = '9e57b18f-46a1-4274-9eda-b56a35ba6027';
UPDATE equipment_catalog SET modello = 'CSD 102 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '9e5f20c9-c509-4046-a2e0-5b3bd12d4dae';
UPDATE equipment_catalog SET modello = 'SN15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 16, 'ptar', 16)
WHERE id = '9e6af8c2-6d12-4f3e-8dfa-8c9d29449f03';
UPDATE equipment_catalog SET modello = 'SM 11',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = '9e7571ae-909f-43d5-8144-cf4344f4062d';
UPDATE equipment_catalog SET modello = 'ASK 27 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = '9fd8a920-ef6e-49c5-bd81-495a5a9f434f';
UPDATE equipment_catalog SET modello = 'ASK 34',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'a0ad2de3-aef5-42a0-9271-bc897e1f0670';
UPDATE equipment_catalog SET modello = 'CSD 82',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'a1422e8e-65db-497a-8caf-9bc87a30e326';
UPDATE equipment_catalog SET modello = 'CSA 10+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'a2facff7-2358-4b13-9d31-c2d3b61adf24';
UPDATE equipment_catalog SET modello = 'SK 21',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'a420fbba-5198-4c8a-8af4-06e8425b6277';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10.8, 'ptar', 10.8)
WHERE id = 'a44f6faa-360a-423c-acd2-bf45fa0fcd3c';
UPDATE equipment_catalog SET modello = 'TA15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.5, 'ptar', 11.5)
WHERE id = 'a4c245df-536f-4b71-9eb8-8353785efc66';
UPDATE equipment_catalog SET modello = 'ASD 47 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'a4d36b91-c430-4109-81d6-6620db58b5f1';
UPDATE equipment_catalog SET modello = 'ASD 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = 'a50d0c29-3574-4e50-b1a2-a4943828f8eb';
UPDATE equipment_catalog SET modello = 'CSA 10 IVR',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'a51d009b-2402-4edc-b3d1-b967e7115834';
UPDATE equipment_catalog SET modello = 'AIRCENTER 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'a53c0a46-df53-4a24-80d8-1e91fe4c1b4a';
UPDATE equipment_catalog SET modello = 'GA 18',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = 'a552db1e-2a87-49fd-9ac5-8afb18f43bc9';
UPDATE equipment_catalog SET modello = 'CSC 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'a564d844-6ab3-4a98-af8f-1bd738f0cc8a';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'ptar', 15)
WHERE id = 'a602ee34-ad96-4514-a3af-7ad30d3ae943';
UPDATE equipment_catalog SET modello = 'DSD 240',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'a61ea715-ed92-4e61-9e1f-56bae32db3ea';
UPDATE equipment_catalog SET modello = 'SM 12T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'a66f4d88-39b0-4a42-a5bb-7ec77ee50676';
UPDATE equipment_catalog SET modello = 'AIRCENTER 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'a7148d79-179a-49d9-a5ec-a9e5d8d93b82';
UPDATE equipment_catalog SET modello = 'SM 12T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'a7dedb8e-0885-44da-9119-6706c701b7fe';
UPDATE equipment_catalog SET modello = 'SK 22',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'a9785154-1b0a-4ef1-b490-94811f609fc1';
UPDATE equipment_catalog SET modello = 'BSD 72 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'a9cc18b5-516a-4485-9e56-d45e20038179';
UPDATE equipment_catalog SET modello = 'SM 12T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'a9ccbe3b-16b0-48fb-b029-cceb2170a715';
UPDATE equipment_catalog SET modello = 'CSDX 140',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'aa99bcaa-2319-4f0a-9c28-77ce224bda56';
UPDATE equipment_catalog SET modello = 'CSD 85 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = 'aaa20f09-ae86-46b7-8303-7675f0c4b276';
UPDATE equipment_catalog SET modello = 'CSA 20',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'ab72e94d-b054-4cf8-9d22-12a7ec18a3b5';
UPDATE equipment_catalog SET modello = 'ASD 35',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = 'ab7cb077-54c7-488e-b726-101aac21fa5a';
UPDATE equipment_catalog SET modello = 'CSD 85 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = 'abb4c557-4671-49e2-81d4-433af0f4379e';
UPDATE equipment_catalog SET modello = 'CSM 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'abf26b58-2f91-4ec5-824e-58df72501972';
UPDATE equipment_catalog SET modello = 'CSA 15+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'ac64d6c3-ee0b-419b-854d-75940cc48549';
UPDATE equipment_catalog SET modello = 'CSD 102 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'acdcef21-d46b-4616-9b77-f1e05a09b2d5';
UPDATE equipment_catalog SET modello = 'SK 21 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'ace50ebe-e902-4be3-b268-c2210c79cd75';
UPDATE equipment_catalog SET modello = 'CSA 20 IVR+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'ad1464fd-697d-42ec-8fe1-c81bd54fbd99';
UPDATE equipment_catalog SET modello = 'GA 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'ad67bba0-419c-4b4f-9697-4a06ee043165';
UPDATE equipment_catalog SET modello = 'AIRCENTER 13 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'ae14eb51-ef87-436b-ae05-1b54075811e9';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.5, 'ptar', 12.44)
WHERE id = 'aea8e090-d182-4c74-bfaa-513f2349566e';
UPDATE equipment_catalog SET modello = 'CSD 85',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'afab74a8-be11-4985-8f93-c9f2fb5a4eeb';
UPDATE equipment_catalog SET modello = 'SM 16 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'afce062f-b2c9-41d7-bd0b-9046a6b371fb';
UPDATE equipment_catalog SET modello = 'SM 13T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'b032da40-b14a-4f21-adc8-bf30507283f9';
UPDATE equipment_catalog SET modello = 'ASK 28 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'b03b9ffc-e2cb-49f5-a54a-8d47ef22d58c';
UPDATE equipment_catalog SET modello = 'AIRTOWER 3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'b07d782e-cfb2-4689-b240-b5f1435dc968';
UPDATE equipment_catalog SET modello = 'SXC 6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'b0a0d642-a3e3-401d-8b2e-9c26a4bc2822';
UPDATE equipment_catalog SET modello = 'CSM 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'b25b7b72-a95f-446a-bd33-ec133f1ac67c';
UPDATE equipment_catalog SET modello = 'ASD 37',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = 'b3a74c3f-7b3f-4beb-8c81-b3e8a5c2ce00';
UPDATE equipment_catalog SET modello = 'DSD 201',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = 'b3af7e22-47ba-4486-a1b4-80f4a05a88d3';
UPDATE equipment_catalog SET modello = 'SM 9T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'b3ee6704-88cf-4f24-a7a5-87bf495caaaf';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.4, 'ptar', 11.4)
WHERE id = 'b453c937-180d-47fa-8f83-30b57f4358ce';
UPDATE equipment_catalog SET modello = 'ASK 32 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'b4c779de-6aeb-487d-b8a2-fbf7624efe4d';
UPDATE equipment_catalog SET modello = 'ASD 50 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'b4e6da62-6847-43a6-bd57-24e812ea7aba';
UPDATE equipment_catalog SET modello = 'SK 24',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'b4f31a99-3f11-4704-aaba-8c74731db86b';
UPDATE equipment_catalog SET modello = 'SK 25 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'b4f9dadd-e8cc-475f-9bf2-d13c7caa1603';
UPDATE equipment_catalog SET modello = 'SK 24 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'b54b2575-90fd-4468-b33b-093c84094c98';
UPDATE equipment_catalog SET modello = 'SX 4',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'b57e01e2-79b4-4e5b-9775-2e24176432b5';
UPDATE equipment_catalog SET modello = 'TA11',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 16, 'ptar', 16)
WHERE id = 'b5cd9bf8-6d75-4fe8-892f-5b90f6e2560d';
UPDATE equipment_catalog SET modello = 'SX 6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'b6745301-5551-4115-8310-76c9c61d9fec';
UPDATE equipment_catalog SET modello = 'CSM 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'b6993cc9-b433-4e71-aae6-9d0a0a0338ac';
UPDATE equipment_catalog SET modello = 'SM 13T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'b74da734-539c-4951-829f-f71a94a18979';
UPDATE equipment_catalog SET modello = 'SM 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'b74e0d60-4307-4356-84cb-0e6dee9adba3';
UPDATE equipment_catalog SET modello = 'ASK 34 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'b7896f24-f3de-4456-9de6-7aaed6cb5619';
UPDATE equipment_catalog SET modello = 'CSM 7,5',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'b880a8b9-41f5-4a01-8a6d-e2601e5bde10';
UPDATE equipment_catalog SET modello = 'DSD 171',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = 'b8d283e1-3c1f-4da2-a6a6-e7cb70a347c0';
UPDATE equipment_catalog SET modello = 'BVC 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'b8d83ffd-f066-4fb0-ba80-4f0cbf8ffa3d';
UPDATE equipment_catalog SET modello = 'CSA 15+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'b910b563-0f92-4e30-a819-c59de78f445a';
UPDATE equipment_catalog SET modello = 'AS 31',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'b928cbf1-c1d9-4d9e-add1-875f1fbc5816';
UPDATE equipment_catalog SET modello = 'ASD 57',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = 'b98d1bb6-70ec-482a-b44c-bef07652134e';
UPDATE equipment_catalog SET modello = 'TA11',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'ptar', 11)
WHERE id = 'b9bb8753-f0d8-482b-838c-63dce5ffa4cf';
UPDATE equipment_catalog SET modello = 'CSA 7,5+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'ba08278e-929c-4ca7-9ada-e930df329d7c';
UPDATE equipment_catalog SET modello = 'CSB 25/8 IVR',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'ba886fbd-05e5-4085-88f9-3d3998a3fd30';
UPDATE equipment_catalog SET modello = 'CSA 10 IVR+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'bbaa6194-c4b3-4a29-912e-5c9391ae7ba6';
UPDATE equipment_catalog SET modello = 'CSDX 165',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'bc35df0f-59a5-4d84-ace6-d756953be6cb';
UPDATE equipment_catalog SET modello = 'ASD 40 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = 'bda75f45-e4a6-43a2-92b3-fb58a71b724e';
UPDATE equipment_catalog SET modello = 'ASD 40 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = 'be15f2ba-aeaa-45be-8aa3-71af1574f13c';
UPDATE equipment_catalog SET modello = 'DSD 240',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = 'be99e3fa-9ae3-4ec1-b9c7-d4b8516f7519';
UPDATE equipment_catalog SET modello = 'SM 15T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'bee988f5-61a4-4c60-8acf-aca6f97564bc';
UPDATE equipment_catalog SET modello = 'SK 22 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'befde26c-ca09-44c5-b306-05ad880e86af';
UPDATE equipment_catalog SET modello = 'BSD 62',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'bf19e909-b639-4018-9350-00a3210fdf2d';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11.44, 'ptar', 11.44)
WHERE id = 'bf6ac948-a36f-4d5c-8368-906b02a0d60b';
UPDATE equipment_catalog SET modello = 'AIRTOWER 11',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = 'bfa64df0-eec0-406c-84fd-81f3e42ac795';
UPDATE equipment_catalog SET modello = 'CSA 10+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'bffae5ff-65f8-44bc-ad28-72d33c5312e0';
UPDATE equipment_catalog SET modello = 'ASK 28',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'c03ffea7-ab67-4998-92ba-fea9774187a1';
UPDATE equipment_catalog SET modello = 'CS 91',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = 'c0c0acce-5666-44de-9e47-5ec7147e97f2';
UPDATE equipment_catalog SET modello = 'ASD 50 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'c16f8716-2012-41f1-9da5-7e2f2e14b339';
UPDATE equipment_catalog SET modello = 'SM 12T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'c289dd54-8973-4894-bc3f-013c18ef780a';
UPDATE equipment_catalog SET modello = 'SK 22 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'c358d6f1-0ec3-4f61-b39c-ec772716bed9';
UPDATE equipment_catalog SET modello = 'SK 22',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'c3e8f438-217b-462b-806e-abce1c28b2cd';
UPDATE equipment_catalog SET modello = 'CSA 15 IVR',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'c4019d6b-9d71-41c8-bd40-3dfdb32c49e1';
UPDATE equipment_catalog SET modello = 'DSD 205',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = 'c448bac7-0a0a-419d-ad20-58df61937e97';
UPDATE equipment_catalog SET modello = 'AIRCENTER 25 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'c5aa8c72-d994-4828-90b3-cfdbd03ad0ce';
UPDATE equipment_catalog SET modello = 'ASK 34 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'c7b58c3b-a2c9-42ad-8b12-5f8e0b747700';
UPDATE equipment_catalog SET modello = 'SM 10 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'c7bbf002-7dd8-42cf-99c7-ee006b93b8e4';
UPDATE equipment_catalog SET modello = 'AIRCENTER 10',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'c7eb05d7-f664-4162-aa36-a66eaf0684f2';
UPDATE equipment_catalog SET modello = 'CSD 102',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'c8333657-009c-42db-8773-74a2c21e3dc9';
UPDATE equipment_catalog SET modello = 'ASK 40 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'c8d6978a-e695-49bc-84ff-e0c8d9ece110';
UPDATE equipment_catalog SET modello = 'TA15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 14, 'ptar', 14)
WHERE id = 'c97b61ca-4bc4-464e-a28c-520e46cfd3ea';
UPDATE equipment_catalog SET modello = 'DS 140',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'c99ab9ff-b3a6-4a28-8910-bfcab1458022';
UPDATE equipment_catalog SET modello = 'TW3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10.5, 'ptar', 10.5)
WHERE id = 'ca34625e-66df-4d75-b1b1-6378cdc61845';
UPDATE equipment_catalog SET modello = 'SM 12',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'cac901d2-828c-46ce-93dc-af2001bfbec6';
UPDATE equipment_catalog SET modello = 'ASK 40 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'cb3369a2-d9f5-4ca0-9198-a4a88eca4561';
UPDATE equipment_catalog SET modello = 'DSD 241',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = 'ccffc857-fb7c-4dc9-ba93-0a3bfa529308';
UPDATE equipment_catalog SET modello = 'SK 25 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = 'cd259e98-5bac-4ad3-a044-7edcef498738';
UPDATE equipment_catalog SET modello = 'BSD 72',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'cd80f295-b2b5-4a7e-8d99-8c7b536ee5ea';
UPDATE equipment_catalog SET modello = 'SM 16',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = 'ce1c48a4-1e17-4a3c-98ce-bb3fa33d25b4';
UPDATE equipment_catalog SET modello = 'CSC 75',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'ce2245ac-02e7-449a-b58e-e9cb8b77e6a6';
UPDATE equipment_catalog SET modello = 'BSD 72',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = 'ce3bb51d-8b8e-4970-a859-689d3eed18a2';
UPDATE equipment_catalog SET modello = 'SM 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'cf906778-aa4d-476d-bf26-f4e001b5e135';
UPDATE equipment_catalog SET modello = 'SK 22 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = 'cfa3ec83-52b1-4444-9167-f0cd12d32cef';
UPDATE equipment_catalog SET modello = 'SX 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'd05f6994-0afc-475a-b7be-93c6da43b901';
UPDATE equipment_catalog SET modello = 'ASD 50 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = 'd154f637-b21e-4e03-b012-0bb771c944eb';
UPDATE equipment_catalog SET modello = 'SM 10 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'd1706a92-080f-44b3-ab8a-902e466c0915';
UPDATE equipment_catalog SET modello = 'SX 6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'd1721876-83e3-4113-a530-2e1f098ed571';
UPDATE equipment_catalog SET modello = 'CSD 105 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'd30f7223-4a26-41c6-b9f0-b3ea71c543ad';
UPDATE equipment_catalog SET modello = 'SM 12 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'd3181c70-da82-41c4-97f2-e7805ba0df6d';
UPDATE equipment_catalog SET modello = 'SM 13 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'd332d03c-1463-4483-88aa-a3fd586b124c';
UPDATE equipment_catalog SET modello = 'TA7',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = 'd40a4709-b3cb-4ee7-8701-bdb0d43bc616';
UPDATE equipment_catalog SET modello = 'SXC 4',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'd40ec680-f048-4e24-bb78-0980ef6b0fc2';
UPDATE equipment_catalog SET modello = 'CSA 15 IVR+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'd4b69df7-e399-448a-abff-0f0b71a43fde';
UPDATE equipment_catalog SET modello = 'SK 25 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'd62ca757-e7df-4e8c-9666-c397b688cf98';
UPDATE equipment_catalog SET modello = 'ASD 60',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = 'd66737ff-0b4e-4683-9f54-25e6f016441a';
UPDATE equipment_catalog SET modello = 'BSD 75',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = 'd74cea8a-dcdd-4f27-83e5-c6596dba8d0c';
UPDATE equipment_catalog SET modello = 'ASD 50',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'd74d2482-ed74-4b96-a8cb-50523ebb472f';
UPDATE equipment_catalog SET modello = 'CS 76',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'd76fb339-b824-4081-9a8d-92f85545f550';
UPDATE equipment_catalog SET modello = 'AIRCENTER 25 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'd8291897-7ed8-4233-9339-74f6d8aaab8f';
UPDATE equipment_catalog SET modello = 'CSA 15+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'd84a2b2c-df7b-4043-9a08-f323b89d5e0c';
UPDATE equipment_catalog SET modello = 'DRD 60 IVR PM',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7, 'pressione_max', 7)
WHERE id = 'd8dec2e9-7182-409c-9f4f-378fffe20b94';
UPDATE equipment_catalog SET modello = 'SM 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'd945a70c-fd8f-47bd-9ab3-ab075516ab19';
UPDATE equipment_catalog SET modello = 'CSC 60',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'd979f3cc-3afa-427f-8c5e-c89ebbdae93a';
UPDATE equipment_catalog SET modello = 'AIRCENTER 13',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'da750c53-9905-4471-9223-88bba9f8479b';
UPDATE equipment_catalog SET modello = 'ASD 60 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 15)
WHERE id = 'db1ef1b7-7009-41ab-bd63-f4c31b0e2ce5';
UPDATE equipment_catalog SET modello = 'SM 15T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'dbf250cf-9643-48eb-a4f0-b02bdfb86323';
UPDATE equipment_catalog SET modello = 'ASK 27 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'dcb743c4-1b4d-4a8d-a127-216e7f5a2e1d';
UPDATE equipment_catalog SET modello = 'SXC 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'dcd5382a-5877-45d8-a03a-8027fa5f59bd';
UPDATE equipment_catalog SET modello = 'SM 13 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'dcdaa5ea-89cc-4cca-9163-28e8aa7ff8f6';
UPDATE equipment_catalog SET modello = 'BSD 75 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'dcfc62bc-ed33-4f89-8732-b651241c0a56';
UPDATE equipment_catalog SET modello = 'ASK 27',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'dd88fdb5-07fe-4365-83d5-c11c0274bee9';
UPDATE equipment_catalog SET modello = 'ASK 34 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = 'ddf06802-ca51-4926-9650-67247fbaadb8';
UPDATE equipment_catalog SET modello = 'ASD 50 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 13)
WHERE id = 'dec02ad1-f4d9-4d55-9fe6-b7a094617f12';
UPDATE equipment_catalog SET modello = 'CSA 5,5',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'dfcf19af-756c-48fa-96df-12bfb5f23717';
UPDATE equipment_catalog SET modello = 'ASD 37 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'e0221498-762e-4f63-b932-b6ae414fdfe6';
UPDATE equipment_catalog SET modello = 'AIRCENTER 13 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'e115e240-a63c-41c6-8d3a-362b220f5bb2';
UPDATE equipment_catalog SET modello = 'DSD 240',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = 'e16687ae-25a6-440c-a147-f58ca9c07f94';
UPDATE equipment_catalog SET modello = 'DS 140',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'e19fe6a5-5e94-4211-a6cc-929edfb19ac8';
UPDATE equipment_catalog SET modello = 'ASD 32',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 15, 'pressione_max', 15)
WHERE id = 'e1d9a321-0a63-47b1-bfbc-0947d96bc9bc';
UPDATE equipment_catalog SET modello = 'SK 24 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'e1f48b8d-5244-4c2e-be2b-dd0ed093ca6b';
UPDATE equipment_catalog SET modello = 'AIRCENTER 25',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'e1fd883d-2858-413b-93ad-d842d7b1bdf6';
UPDATE equipment_catalog SET modello = 'SK 25 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'e2404487-1ae9-4a8d-ad5e-625f424a8653';
UPDATE equipment_catalog SET modello = 'GA 111',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = 'e350b2d6-2a4c-450b-accd-3f0c030ffa5c';
UPDATE equipment_catalog SET modello = 'ASD 60 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'e3b65196-365e-455d-8ebf-627498edbc9b';
UPDATE equipment_catalog SET modello = 'AIRCENTER 9',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'e42f4ddd-b43e-4f09-afb1-e15f83ae3cd6';
UPDATE equipment_catalog SET modello = 'SM 12T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'e493b560-176f-4542-973b-bec7b1bd9a49';
UPDATE equipment_catalog SET modello = 'ASD 50 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = 'e70efdc0-2049-42e7-aa3b-80bd01c716fa';
UPDATE equipment_catalog SET modello = 'CSA 15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'e74ebadb-510a-4b4b-938d-f14cdc0a96a2';
UPDATE equipment_catalog SET modello = 'CSM 20',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'e79ad4c4-6561-4dda-b143-ae858c7d4370';
UPDATE equipment_catalog SET modello = 'SK 24 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'e867808d-14b1-4da1-a7d0-765fa2debe73';
UPDATE equipment_catalog SET modello = 'ASK 32 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'e8cd7bf7-7565-414d-abbe-a63028dc5249';
UPDATE equipment_catalog SET modello = 'CSA 7,5+TANK500+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'e8d44b5f-3438-4f1e-8c4f-e96dc7b1b827';
UPDATE equipment_catalog SET modello = 'DRD 75 IVR PM',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12.5, 'pressione_max', 12.5)
WHERE id = 'e9234190-353f-45d4-a11a-4fbd4bf00f84';
UPDATE equipment_catalog SET modello = 'CSM 20',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'e93159b3-faad-4ed6-a2bd-07175a165492';
UPDATE equipment_catalog SET modello = 'ASK 32',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'e9f8cf54-803b-4b74-a727-8e51b795c2d3';
UPDATE equipment_catalog SET modello = 'BSD 65',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = 'e9fde2f9-fc41-4dde-8e0e-b40d90c248bf';
UPDATE equipment_catalog SET modello = 'ASD 35 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 12)
WHERE id = 'eadc121a-93c8-42d6-970f-e7dda8297bad';
UPDATE equipment_catalog SET modello = 'CSD 110',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8.5, 'pressione_max', 8.5)
WHERE id = 'eb11e10e-64e9-4c63-957a-c4958663a2d5';
UPDATE equipment_catalog SET modello = 'SK 25',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'eb648db7-8ca0-4a54-9041-c9e20bee9bf4';
UPDATE equipment_catalog SET modello = 'CSD 102',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'ebc434de-61eb-4f31-8e10-f0a4c918797b';
UPDATE equipment_catalog SET modello = 'AIRCENTER 9',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 15)
WHERE id = 'ec629de6-44e5-4c33-9b67-6c71251218f5';
UPDATE equipment_catalog SET modello = 'ASD 60 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = 'ed5eb4ed-b4ad-4a6b-8f66-82a4a83d0820';
UPDATE equipment_catalog SET modello = 'SM 13 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'edacebec-d50c-4638-840f-9b1646565e41';
UPDATE equipment_catalog SET modello = 'SM 10 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'ee29b9b1-4a2a-4a25-a5a5-cfb75f8320dc';
UPDATE equipment_catalog SET modello = 'H10N',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 42, 'ptar', 42)
WHERE id = 'eea3b653-85fa-4afe-8902-8ba1de0988dc';
UPDATE equipment_catalog SET modello = 'AIRTOWER 6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'eeb83d49-640d-4cc8-9dec-301fc57dfb2e';
UPDATE equipment_catalog SET modello = 'ASK 32',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'f0377af8-aca4-4326-b489-360b0bf081cc';
UPDATE equipment_catalog SET modello = 'DSD 205',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'f0c8f177-c21f-473c-8b6c-930d81dd1870';
UPDATE equipment_catalog SET modello = 'SXC 6',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'f1520d63-b956-4645-a2be-ac20480e3bd2';
UPDATE equipment_catalog SET modello = 'SM 13',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'f17943b3-e61f-4d1a-81a8-8ddbbb0b5dc6';
UPDATE equipment_catalog SET modello = 'SM 13 T',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'f1f2b4a1-ea9e-4ccb-9fb0-30e3e1e9f30a';
UPDATE equipment_catalog SET modello = 'CSA 20+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'f241b944-07c6-4270-a329-11554f2d08fb';
UPDATE equipment_catalog SET modello = 'SXC 3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'f27eeb00-d72d-45a2-9d13-72d6b2fc42c2';
UPDATE equipment_catalog SET modello = 'AIRTOWER 8',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 7.5)
WHERE id = 'f35711ac-3f7b-40cc-b178-2f8c5068d80d';
UPDATE equipment_catalog SET modello = 'CSD 110',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 12, 'pressione_max', 12)
WHERE id = 'f35fd78d-0b22-4a45-be3f-d60f3cca304c';
UPDATE equipment_catalog SET modello = 'CSA 20+TANK500',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'f369498f-5b70-48a7-9176-a981e80cb4c3';
UPDATE equipment_catalog SET modello = 'ASK 40 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 11)
WHERE id = 'f37d9982-eea0-4d4f-92b1-7057b2cdc687';
UPDATE equipment_catalog SET modello = 'Rollair RLR 750 B',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'f3dc965f-9b7b-442e-b62a-9f501d05779a';
UPDATE equipment_catalog SET modello = 'SX 3',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'f4177ae4-83db-4f57-af21-eba6b2007cf1';
UPDATE equipment_catalog SET modello = 'SM 12 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'f4a3566e-f2e1-4970-85ac-01c39b021d00';
UPDATE equipment_catalog SET modello = 'CSM 20',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'f5dcdef9-98d0-4add-9a12-0827fce506df';
UPDATE equipment_catalog SET modello = 'TA15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'ptar', 10)
WHERE id = 'f7077ad9-a99d-41bf-9b6e-7520c0425e44';
UPDATE equipment_catalog SET modello = 'CSC 40',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'f76c5807-befb-4857-aef7-932006a722d0';
UPDATE equipment_catalog SET modello = 'AIRTOWER 4',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'f788d6bd-be83-4d0b-b7a9-84e50cfd46b9';
UPDATE equipment_catalog SET modello = 'SK 26',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'f7d84fe6-bd63-4938-ab8d-11321a533ff6';
UPDATE equipment_catalog SET modello = 'AIRCENTER 13',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'f82c985d-e354-454b-a433-7d80febb8df1';
UPDATE equipment_catalog SET modello = 'SK 25 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'f895027d-f7b4-413e-94ba-a49f4ae7be98';
UPDATE equipment_catalog SET modello = 'ASD 50 SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8.5)
WHERE id = 'f9113a68-80a4-4a8d-bbab-31f41daddbdd';
UPDATE equipment_catalog SET modello = 'CSD 122',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 8, 'pressione_max', 8)
WHERE id = 'f913ce22-b799-46d8-a42d-2ee0f4b91a20';
UPDATE equipment_catalog SET modello = 'SM 11',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'f99b7d12-be37-4f9d-9ef6-2b6c6c43b969';
UPDATE equipment_catalog SET modello = 'CSD 82',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'f9edcff6-0775-4d03-91bd-cef39040a749';
UPDATE equipment_catalog SET modello = 'ASK 34 T SFC',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 11, 'pressione_max', 15)
WHERE id = 'f9fc4dce-1adc-40dc-916b-8b2b04ad5920';
UPDATE equipment_catalog SET modello = 'SM 12',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'fa8d8e87-28d3-453c-ba5b-9308c388a2a1';
UPDATE equipment_catalog SET modello = 'CSD 125',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'fa9ca41f-1f09-4b3c-b722-db713f54dd39';
UPDATE equipment_catalog SET modello = 'TA11',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10.45, 'ptar', 10.45)
WHERE id = 'faef9867-4fef-44e5-aae4-4b5ea6105f44';
UPDATE equipment_catalog SET modello = 'DRD 100 IVR PM',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 9.5, 'pressione_max', 9.5)
WHERE id = 'fc3b9c2a-eb52-4288-bf12-1d9d33df57d9';
UPDATE equipment_catalog SET modello = 'SM 13',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 7.5, 'pressione_max', 8)
WHERE id = 'fcce4573-5da0-42a2-9659-65d93e56bc27';
UPDATE equipment_catalog SET modello = 'CSA 20 IVR+TANK270',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 10)
WHERE id = 'fd1d5981-1c5b-4f47-90bf-a2f0c24793cc';
UPDATE equipment_catalog SET modello = 'CSC 50',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 13)
WHERE id = 'fd951b83-a29e-40c0-95fc-c5f87f438403';
UPDATE equipment_catalog SET modello = 'CSDX 137',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'fe50f8ac-9ce5-46f9-b17f-c669082cdd83';
UPDATE equipment_catalog SET modello = 'BSD 83',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 13, 'pressione_max', 15)
WHERE id = 'fe978643-1267-4e22-8193-badbae6d7eb8';
UPDATE equipment_catalog SET modello = 'TA15',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 9.4, 'ptar', 9.4)
WHERE id = 'fea06cd8-3739-4ce1-b2b6-2044a2a1a1ba';
UPDATE equipment_catalog SET modello = 'AIRCENTER 16',
  specs = (COALESCE(specs, '{}'::jsonb) - 'pressione') || jsonb_build_object('pressione_esercizio', 10, 'pressione_max', 11)
WHERE id = 'fed4cf32-e424-47cb-8cc1-a4f3a0a839b9';

-- Schede dati: allineamento dei riferimenti al catalogo rinominato.
-- Le pratiche citano il catalogo per marca e modello: senza questo passaggio
-- resterebbero scollegate.
UPDATE dm329_technical_data SET equipment_data = replace(
  equipment_data::text, '"modello": "TA11 (@11bar)"', '"modello": "TA11"')::jsonb
WHERE id = '45deaec6-a414-473a-826d-619d0cb95149';
UPDATE dm329_technical_data SET equipment_data = replace(
  equipment_data::text, '"modello": "CSM 20 (@10bar)"', '"modello": "CSM 20"')::jsonb
WHERE id = '45deaec6-a414-473a-826d-619d0cb95149';
UPDATE dm329_technical_data SET equipment_data = replace(
  equipment_data::text, '"modello": "CSM 20 (@10bar)"', '"modello": "CSM 20"')::jsonb
WHERE id = '45deaec6-a414-473a-826d-619d0cb95149';
UPDATE dm329_technical_data SET equipment_data = replace(
  equipment_data::text, '"modello": "ASD 50 (@13bar)"', '"modello": "ASD 50"')::jsonb
WHERE id = '6b6d1ea6-e29a-4c85-aa96-280716a5f4e8';
UPDATE dm329_technical_data SET equipment_data = replace(
  equipment_data::text, '"modello": "ASD 40 (@13bar)"', '"modello": "ASD 40"')::jsonb
WHERE id = '88cfbec3-5a33-42a7-a45b-9d43911d1909';

COMMIT;

-- Verifica:
--   SELECT count(*) FROM equipment_catalog WHERE modello ILIKE '%bar%';  -- atteso 13
--   SELECT count(*) FROM equipment_catalog WHERE specs ? 'pressione';    -- atteso 633
--   SELECT count(*) FROM equipment_catalog_normalization_log;            -- atteso 540
