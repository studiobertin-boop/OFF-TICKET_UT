-- Migration: auto-assign client code when creating a DM329 practice
-- Date: 2026-07-06
-- Description:
--   Ogni pratica DM329 implica un cliente "gestito", quindi deve avere un codice cliente.
--   Se si crea una richiesta DM329/DM329-Integrazioni per un cliente senza identificativo,
--   gli si assegna automaticamente il prossimo codice della sequenza. Garanzia lato DB per
--   qualunque percorso di creazione. Riusa customer_identificativo_seq / codice_cliente_num.

CREATE OR REPLACE FUNCTION auto_assign_customer_code_for_dm329()
RETURNS TRIGGER AS $$
DECLARE
  v_type text;
  v_has_code boolean;
  v_num integer;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_type FROM request_types WHERE id = NEW.request_type_id;
  IF v_type NOT IN ('DM329', 'DM329-Integrazioni') THEN
    RETURN NEW;
  END IF;

  SELECT (identificativo IS NOT NULL AND identificativo <> '')
  INTO v_has_code
  FROM customers
  WHERE id = NEW.customer_id;

  -- cliente assente o già codificato -> niente da fare
  IF v_has_code IS DISTINCT FROM false THEN
    RETURN NEW;
  END IF;

  -- Prossimo codice libero (robusto contro codici manuali sopra la sequenza)
  v_num := nextval('customer_identificativo_seq');
  SELECT GREATEST(v_num, COALESCE(MAX(codice_cliente_num), 0) + 1) INTO v_num FROM customers;
  PERFORM setval('customer_identificativo_seq', v_num, true);

  UPDATE customers
  SET identificativo = LPAD(v_num::text, 3, '0')
  WHERE id = NEW.customer_id
    AND (identificativo IS NULL OR identificativo = '');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_assign_customer_code ON requests;
CREATE TRIGGER trigger_auto_assign_customer_code
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_customer_code_for_dm329();

COMMENT ON FUNCTION auto_assign_customer_code_for_dm329() IS
  'Assegna automaticamente il prossimo codice cliente quando si crea una pratica DM329 per un cliente senza codice.';
