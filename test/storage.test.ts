import { beforeEach, describe, expect, it } from 'vitest';
import { ChartInputStorage } from '../src/core/storage';
import { validateBirthInput } from '../src/core/validation';

describe('Chart Input Storage & Recomputation', () => {
  let storage: ChartInputStorage;

  beforeEach(() => {
    storage = new ChartInputStorage();
  });

  it('stores raw user input and allows retrieval for recomputation', async () => {
    const payload = {
      date: '1992-10-24',
      hours: 6,
      minutes: 15,
      seconds: 40,
      placeText: 'Kuala Lumpur, Malaysia',
      latitude: 3.139,
      longitude: 101.6869,
      timezone: 'Asia/Kuala_Lumpur',
      country: 'Malaysia',
      countryCode: 'MY',
      ayanamsa: 'kp_new',
    };

    const validation = validateBirthInput(payload);
    expect(validation.valid).toBe(true);

    const saved = await storage.save(validation.resolvedChartInput!);
    expect(saved.id).toBeDefined();

    const retrieved = await storage.get(saved.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.rawInput.date).toBe('1992-10-24');
    expect(retrieved?.rawInput.hours).toBe(6);
    expect(retrieved?.rawInput.minutes).toBe(15);
    expect(retrieved?.rawInput.seconds).toBe(40);
    expect(retrieved?.rawInput.placeText).toBe('Kuala Lumpur, Malaysia');
    expect(retrieved?.rawInput.latitude).toBe(3.139);
    expect(retrieved?.rawInput.longitude).toBe(101.6869);
    expect(retrieved?.rawInput.timezone).toBe('Asia/Kuala_Lumpur');
    expect(retrieved?.rawInput.ayanamsa).toBe('kp_new');

    expect(retrieved?.resolvedTime.offsetString).toBe('UTC+08:00');
  });

  it('lists stored chart records', async () => {
    const v1 = validateBirthInput({
      date: '1985-05-15',
      hours: 14,
      minutes: 30,
      seconds: 25,
      placeText: 'Chennai',
      latitude: 13.0827,
      longitude: 80.2707,
      timezone: 'Asia/Kolkata',
      ayanamsa: 'kp_old',
    });

    await storage.save(v1.resolvedChartInput!);
    const list = await storage.list();
    expect(list.length).toBe(1);
  });
});
