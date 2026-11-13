import {
  optimizeConstrainedEventOrder,
  type OrderConstraints,
} from "./event-order-constraints";
import type { RegistrationLike } from "./event-rest-utils";
self.onmessage = (
  event: MessageEvent<{
    registrations: RegistrationLike[];
    order: string[];
    constraints: OrderConstraints;
  }>,
) => {
  try {
    const { registrations, order, constraints } = event.data;
    self.postMessage({
      result: optimizeConstrainedEventOrder(registrations, order, constraints),
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Could not optimize this program.",
    });
  }
};
