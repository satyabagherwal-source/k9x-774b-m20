/**
 * approval-gate.mjs
 * 
 * HumanApprovalGate Contract for Stage D Shared Harvesting Pipeline
 * Enforces explicit approval policy: only APPROVED records proceed to canonical persistence.
 * Unapproved records are safely routed to 11_INBOX staged storage without silent loss.
 */

export class HumanApprovalGate {
  /**
   * Evaluates admission eligibility for a candidate record.
   * @param {object} candidate 
   * @param {object} routingDestination 
   * @returns {object} { admitted_to_canonical: boolean, routing_action: string, reason: string }
   */
  evaluate(candidate, routingDestination) {
    if (!candidate) {
      return {
        admitted_to_canonical: false,
        routing_action: 'REJECT_INVALID',
        reason: 'Candidate is null or undefined'
      };
    }

    // Explicit approval check
    if (candidate.approval_status === 'APPROVED') {
      return {
        admitted_to_canonical: true,
        routing_action: 'PERSIST_CANONICAL',
        target_folder: routingDestination.targetFolder,
        reason: 'Record has explicit human approval status APPROVED.'
      };
    }

    if (candidate.approval_status === 'REJECTED') {
      return {
        admitted_to_canonical: false,
        routing_action: 'ARCHIVE_REJECTED_INBOX',
        target_folder: '11_INBOX',
        reason: 'Record has status REJECTED. Routed to 11_INBOX for audit archive.'
      };
    }

    // Default: PENDING_APPROVAL
    return {
      admitted_to_canonical: false,
      routing_action: 'STAGE_INBOX_PENDING',
      target_folder: '11_INBOX',
      reason: 'Record has approval_status PENDING_APPROVAL. Staged in 11_INBOX awaiting human review.'
    };
  }
}

