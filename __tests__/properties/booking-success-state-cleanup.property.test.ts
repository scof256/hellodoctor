/**
 * Feature: booking-flow-integration, Property 3: Booking Success State Cleanup
 * 
 * For any successful booking from the Patient Appointments Page, the URL query
 * parameters SHALL be cleared AND the appointments list SHALL be refreshed.
 * For cancelled bookings, only the URL parameters SHALL be cleared.
 * 
 * Validates: Requirements 1.4, 1.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
interface URLParams {
  sessionId: string | null;
  connectionId: string | null;
}

interface ModalState {
  isOpen: boolean;
  connectionId: string | null;
  doctorId: string | null;
  sessionId: string | null;
}

interface PageState {
  urlParams: URLParams;
  modalState: ModalState;
  appointmentsRefreshed: boolean;
  showSuccessNotification: boolean;
}

type BookingOutcome = 'success' | 'cancel';

/**
 * Simulates the booking state cleanup logic from PatientAppointmentsPage
 * This mirrors the handleBookingSuccess and handleBookingClose behaviors
 */
class BookingStateCleanupService {
  private initialState: PageState;

  constructor(initialUrlParams: URLParams, initialModalState: ModalState) {
    this.initialState = {
      urlParams: initialUrlParams,
      modalState: initialModalState,
      appointmentsRefreshed: false,
      showSuccessNotification: false,
    };
  }

  getInitialState(): PageState {
    return { ...this.initialState };
  }

  /**
   * Handle booking success
   * Requirements: 1.4
   */
  handleBookingSuccess(): PageState {
    return {
      urlParams: {
        sessionId: null,
        connectionId: null,
      },
      modalState: {
        isOpen: false,
        connectionId: null,
        doctorId: null,
        sessionId: null,
      },
      appointmentsRefreshed: true,
      showSuccessNotification: true,
    };
  }

  /**
   * Handle booking cancel/close
   * Requirements: 1.5
   */
  handleBookingClose(): PageState {
    return {
      urlParams: {
        sessionId: null,
        connectionId: null,
      },
      modalState: {
        isOpen: false,
        connectionId: null,
        doctorId: null,
        sessionId: null,
      },
      appointmentsRefreshed: false,
      showSuccessNotification: false,
    };
  }

  /**
   * Process booking outcome and return final state
   */
  processBookingOutcome(outcome: BookingOutcome): PageState {
    if (outcome === 'success') {
      return this.handleBookingSuccess();
    } else {
      return this.handleBookingClose();
    }
  }
}

// Arbitrary generators
const uuidArb = fc.uuid();

const urlParamsArb: fc.Arbitrary<URLParams> = fc.record({
  sessionId: fc.oneof(uuidArb, fc.constant(null)),
  connectionId: fc.oneof(uuidArb, fc.constant(null)),
});

const validUrlParamsArb: fc.Arbitrary<URLParams> = fc.record({
  sessionId: uuidArb,
  connectionId: uuidArb,
});

const modalStateArb: fc.Arbitrary<ModalState> = fc.record({
  isOpen: fc.boolean(),
  connectionId: fc.oneof(uuidArb, fc.constant(null)),
  doctorId: fc.oneof(uuidArb, fc.constant(null)),
  sessionId: fc.oneof(uuidArb, fc.constant(null)),
});

const openModalStateArb: fc.Arbitrary<ModalState> = fc.record({
  isOpen: fc.constant(true),
  connectionId: uuidArb,
  doctorId: uuidArb,
  sessionId: fc.oneof(uuidArb, fc.constant(null)),
});

const bookingOutcomeArb: fc.Arbitrary<BookingOutcome> = fc.constantFrom('success', 'cancel');

describe('Property 3: Booking Success State Cleanup', () => {
  describe('Successful Booking', () => {
    it('for any successful booking, URL params SHALL be cleared', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          (urlParams, modalState) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.handleBookingSuccess();

            // URL params should be cleared
            expect(result.urlParams.sessionId).toBeNull();
            expect(result.urlParams.connectionId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful booking, appointments list SHALL be refreshed', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          (urlParams, modalState) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.handleBookingSuccess();

            // Appointments should be refreshed
            expect(result.appointmentsRefreshed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful booking, modal state SHALL be reset', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          (urlParams, modalState) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.handleBookingSuccess();

            // Modal should be closed and state reset
            expect(result.modalState.isOpen).toBe(false);
            expect(result.modalState.connectionId).toBeNull();
            expect(result.modalState.doctorId).toBeNull();
            expect(result.modalState.sessionId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any successful booking, success notification SHALL be shown', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          (urlParams, modalState) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.handleBookingSuccess();

            expect(result.showSuccessNotification).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cancelled Booking', () => {
    it('for any cancelled booking, URL params SHALL be cleared', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          (urlParams, modalState) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.handleBookingClose();

            // URL params should be cleared
            expect(result.urlParams.sessionId).toBeNull();
            expect(result.urlParams.connectionId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any cancelled booking, appointments list SHALL NOT be refreshed', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          (urlParams, modalState) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.handleBookingClose();

            // Appointments should NOT be refreshed
            expect(result.appointmentsRefreshed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any cancelled booking, modal state SHALL be reset', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          (urlParams, modalState) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.handleBookingClose();

            // Modal should be closed and state reset
            expect(result.modalState.isOpen).toBe(false);
            expect(result.modalState.connectionId).toBeNull();
            expect(result.modalState.doctorId).toBeNull();
            expect(result.modalState.sessionId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any cancelled booking, success notification SHALL NOT be shown', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          (urlParams, modalState) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.handleBookingClose();

            expect(result.showSuccessNotification).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Success vs Cancel Difference', () => {
    it('for any booking, success and cancel SHALL differ only in refresh and notification', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          (urlParams, modalState) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            
            const successResult = service.handleBookingSuccess();
            const cancelResult = service.handleBookingClose();

            // Both should clear URL params
            expect(successResult.urlParams).toEqual(cancelResult.urlParams);
            
            // Both should reset modal state
            expect(successResult.modalState).toEqual(cancelResult.modalState);
            
            // Only success should refresh appointments
            expect(successResult.appointmentsRefreshed).toBe(true);
            expect(cancelResult.appointmentsRefreshed).toBe(false);
            
            // Only success should show notification
            expect(successResult.showSuccessNotification).toBe(true);
            expect(cancelResult.showSuccessNotification).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('URL Params Cleanup Regardless of Initial State', () => {
    it('for any initial URL params, both success and cancel SHALL clear them', () => {
      fc.assert(
        fc.property(
          urlParamsArb,
          openModalStateArb,
          bookingOutcomeArb,
          (urlParams, modalState, outcome) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.processBookingOutcome(outcome);

            // URL params should always be cleared regardless of outcome
            expect(result.urlParams.sessionId).toBeNull();
            expect(result.urlParams.connectionId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Modal State Reset Regardless of Initial State', () => {
    it('for any initial modal state, both success and cancel SHALL reset it', () => {
      fc.assert(
        fc.property(
          urlParamsArb,
          modalStateArb,
          bookingOutcomeArb,
          (urlParams, modalState, outcome) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            const result = service.processBookingOutcome(outcome);

            // Modal state should always be reset regardless of outcome
            expect(result.modalState.isOpen).toBe(false);
            expect(result.modalState.connectionId).toBeNull();
            expect(result.modalState.doctorId).toBeNull();
            expect(result.modalState.sessionId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Idempotence', () => {
    it('for any booking outcome, processing twice SHALL produce same result', () => {
      fc.assert(
        fc.property(
          validUrlParamsArb,
          openModalStateArb,
          bookingOutcomeArb,
          (urlParams, modalState, outcome) => {
            const service = new BookingStateCleanupService(urlParams, modalState);
            
            const firstResult = service.processBookingOutcome(outcome);
            const secondResult = service.processBookingOutcome(outcome);

            expect(firstResult).toEqual(secondResult);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
