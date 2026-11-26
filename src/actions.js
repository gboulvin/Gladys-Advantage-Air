// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'actions' });

function countOf(object) {
  return Object.keys(object ?? {}).length;
}

/**
 * Summary of a system, in the four languages.
 */
export function describeSystemSummary(data) {
  const aircons = countOf(data.aircons);
  const zones = Object.values(data.aircons ?? {}).reduce(
    (total, aircon) => total + countOf(aircon.zones),
    0,
  );
  const lights = countOf(data.myLights?.lights);
  const things = countOf(data.myThings?.things);
  const name = String(data.system?.name ?? 'Advantage Air').slice(0, 40);
  return {
    en: `Connected to "${name}": ${aircons} air conditioner(s), ${zones} zone(s), ${lights} light(s), ${things} MyThings channel(s).`,
    fr: `Connecté à « ${name} » : ${aircons} climatiseur(s), ${zones} zone(s), ${lights} lumière(s), ${things} canal(aux) MyThings.`,
    de: `Verbunden mit „${name}“: ${aircons} Klimaanlage(n), ${zones} Zone(n), ${lights} Leuchte(n), ${things} MyThings-Kanal/Kanäle.`,
    es: `Conectado a «${name}»: ${aircons} aire(s) acondicionado(s), ${zones} zona(s), ${lights} luz(ces), ${things} canal(es) MyThings.`,
  };
}

export const ACTIONS = {
  /**
   * Read the tablet once and say what was found.
   */
  async test_connection(hub) {
    if (!hub.isConfigured()) {
      return {
        en: 'Enter the address of the tablet first, then save.',
        fr: "Saisissez d'abord l'adresse de la tablette, puis enregistrez.",
        de: 'Geben Sie zuerst die Adresse des Tablets ein und speichern Sie.',
        es: 'Introduzca primero la dirección de la tableta y guarde.',
      };
    }
    try {
      await hub.refresh();
      return describeSystemSummary(hub.data);
    } catch (err) {
      logger.warn(`Connection test failed: ${err.message}`);
      throw new Error(`Cannot reach the tablet: ${err.message}`, { cause: err });
    }
  },
};
