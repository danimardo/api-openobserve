import {
  exceedsMessageLimit,
  exceedsBatchLimit,
  exceedsBodyLimit,
  exceedsFieldLimit,
  exceedsValueLimit,
} from '../../src/domain/limits/limits';

describe('Límites puras del dominio (FR-031)', () => {
  describe('exceedsMessageLimit', () => {
    it('devuelve false cuando message está dentro del límite', () => {
      expect(exceedsMessageLimit('hello', 100)).toBe(false);
    });

    it('devuelve true cuando message supera el límite', () => {
      expect(exceedsMessageLimit('x'.repeat(101), 100)).toBe(true);
    });

    it('devuelve false exactamente en el límite', () => {
      expect(exceedsMessageLimit('x'.repeat(100), 100)).toBe(false);
    });
  });

  describe('exceedsBatchLimit', () => {
    it('devuelve false cuando el batch está dentro del límite', () => {
      expect(exceedsBatchLimit(499, 500)).toBe(false);
    });

    it('devuelve true cuando el batch supera el límite', () => {
      expect(exceedsBatchLimit(501, 500)).toBe(true);
    });

    it('devuelve false exactamente en el límite', () => {
      expect(exceedsBatchLimit(500, 500)).toBe(false);
    });
  });

  describe('exceedsBodyLimit', () => {
    it('devuelve false para body dentro del límite en MB', () => {
      expect(exceedsBodyLimit(4 * 1024 * 1024, 5)).toBe(false);
    });

    it('devuelve true cuando el body supera el límite en MB', () => {
      expect(exceedsBodyLimit(6 * 1024 * 1024, 5)).toBe(true);
    });
  });

  describe('exceedsFieldLimit', () => {
    it('devuelve false cuando los campos están dentro del límite', () => {
      expect(exceedsFieldLimit(199, 200)).toBe(false);
    });

    it('devuelve true cuando los campos superan el límite', () => {
      expect(exceedsFieldLimit(201, 200)).toBe(true);
    });
  });

  describe('exceedsValueLimit', () => {
    it('devuelve false para string dentro del límite', () => {
      expect(exceedsValueLimit('short', 100)).toBe(false);
    });

    it('devuelve true cuando el string supera el límite', () => {
      expect(exceedsValueLimit('x'.repeat(101), 100)).toBe(true);
    });
  });
});
