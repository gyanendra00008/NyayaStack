/**
 * Institutional Hierarchy and Grievance Routing Engine
 * NyayaStack Authority & Department Structure
 */

// Hierarchical designation rankings per department.
// Index 0 = Rank 1 (Highest Authority / Executive Head)
// Index (length - 1) = Rank N (Lowest Rank Authority / Field Redressal Desk)
const DEPARTMENT_DESIGNATIONS = {
  "Academic Affairs": [
    "Dean (Academic Affairs)",
    "Head of Department (HOD)",
    "Faculty Coordinator",
    "Academic Counselor",
    "Program Coordinator",
  ],
  "Hostel & Mess": [
    "Chief Warden",
    "Warden",
    "Assistant Warden",
    "Hostel Supervisor",
    "Mess Committee In-Charge",
    "Caretaker",
  ],
  "Examination Cell": [
    "Controller of Examinations (COE)",
    "Assistant Controller of Examinations",
    "Examination Superintendent",
    "Evaluation Coordinator",
    "Administrative Officer",
  ],
  "Anti-Ragging Committee": [
    "Committee Chairperson",
    "Committee Member",
    "Squad In-Charge",
    "Faculty Representative",
  ],
  "Internal Complaints Committee": [
    "Presiding Officer",
    "Committee Member",
    "Legal Advisor",
    "Faculty Representative",
    "Counselor",
  ],
  "Library": [
    "Chief Librarian",
    "Assistant Librarian",
    "Information Officer",
    "Library Assistant",
  ],
  "IT & Infrastructure": [
    "IT Head / CTO",
    "System Administrator",
    "Network Engineer",
    "Estate / Works Officer",
    "Maintenance Supervisor",
  ],
  "Administration": [
    "Registrar",
    "Deputy Registrar",
    "Assistant Registrar",
    "Administrative Officer",
    "Section Officer",
    "Grievance Redressal Officer",
  ],
};

// Authoritative mapping of grievance categories to institutional departments
const CATEGORY_TO_DEPARTMENT = {
  "Hostel": "Hostel & Mess",
  "Mess": "Hostel & Mess",
  "Academic": "Academic Affairs",
  "Infrastructure": "IT & Infrastructure",
  "Administration": "Administration",
  "Finance": "Administration",
  "Harassment": "Internal Complaints Committee",
  "Ragging": "Anti-Ragging Committee",
  "Discipline": "Administration",
  "Transport": "Administration",
  "Medical": "Administration",
  "Other": "Administration",
};

// Department to handled categories mapping
const DEPARTMENT_TO_CATEGORIES = {
  "Hostel & Mess": ["Hostel", "Mess"],
  "Academic Affairs": ["Academic"],
  "Examination Cell": ["Academic"],
  "Anti-Ragging Committee": ["Ragging"],
  "Internal Complaints Committee": ["Harassment"],
  "Library": ["Academic", "Infrastructure", "Other"],
  "IT & Infrastructure": ["Infrastructure"],
  "Administration": ["Administration", "Finance", "Discipline", "Transport", "Medical", "Other"],
};

/**
 * Returns numeric rank for a given department and designation.
 * 1 is the highest rank (e.g. Dean, Registrar, Chief Warden).
 * Higher numbers represent lower ranks (e.g. 6 is Caretaker, the lowest rank).
 */
function getRankForDesignation(department, designation) {
  if (!department || !designation) return 999;
  const list = DEPARTMENT_DESIGNATIONS[department];
  if (!Array.isArray(list)) return 999;

  const idx = list.findIndex(
    (d) => d.trim().toLowerCase() === designation.trim().toLowerCase()
  );
  if (idx === -1) return 999;
  return idx + 1; // 1-based index: Rank 1 is top, Rank N is lowest
}

/**
 * Returns the lowest (deepest/most junior) designation string for a department.
 */
function getLowestRankDesignation(department) {
  const list = DEPARTMENT_DESIGNATIONS[department];
  if (!Array.isArray(list) || list.length === 0) {
    return "Grievance Redressal Officer";
  }
  return list[list.length - 1];
}

/**
 * Returns the lowest rank number for a department (e.g. 6 for Hostel & Mess).
 */
function getLowestRankNumber(department) {
  const list = DEPARTMENT_DESIGNATIONS[department];
  if (!Array.isArray(list) || list.length === 0) {
    return 999;
  }
  return list.length;
}

/**
 * Resolves the lowest rank authority for a given category and department.
 * Finds all active approved officers, filters by category eligibility,
 * and picks the officer with the lowest rank (maximum rank number).
 * If no approved officer exists, returns the canonical lowest rank designation for that department.
 *
 * @param {Object} params
 * @param {string} params.department
 * @param {string} params.category
 * @param {mongoose.Model} params.UserModel
 */
async function findLowestRankAuthority({ department, category, UserModel }) {
  const resolvedDept = department || CATEGORY_TO_DEPARTMENT[category] || "Administration";

  if (!UserModel) {
    const defaultDesignation = getLowestRankDesignation(resolvedDept);
    return {
      assignedTo: null,
      assignedOfficer: null,
      assignedDesignation: defaultDesignation,
      assignedRank: getLowestRankNumber(resolvedDept),
      department: resolvedDept,
    };
  }

  // Query approved officers in this department
  const query = {
    role: "officer",
    verificationStatus: "approved",
    isVerified: true,
    department: resolvedDept,
  };

  const officers = await UserModel.find(query).lean();

  // Filter officers who handle this category
  // An officer matches if:
  // - officer.category matches category (case-insensitive) OR
  // - officer.category is empty / "All"
  const normalizedCat = (category || "").trim().toLowerCase();
  const eligibleOfficers = officers.filter((officer) => {
    if (!officer.category || officer.category.trim() === "" || officer.category.toLowerCase() === "all") {
      return true;
    }
    return officer.category.trim().toLowerCase() === normalizedCat;
  });

  // Calculate effective rank for each officer
  // Note: Rank 1 is highest, larger rank numbers indicate lower hierarchy positions
  const rankedOfficers = eligibleOfficers.map((officer) => {
    const calcRank = getRankForDesignation(resolvedDept, officer.designation);
    const effectiveRank =
      typeof officer.rank === "number" && officer.rank !== 999 ? officer.rank : calcRank;
    return {
      ...officer,
      effectiveRank,
    };
  });

  if (rankedOfficers.length > 0) {
    // Sort descending by effectiveRank (highest rank number = lowest in rank hierarchy)
    rankedOfficers.sort((a, b) => b.effectiveRank - a.effectiveRank);

    // Get the maximum rank number among eligible officers (the lowest rank authority)
    const lowestRankNumber = rankedOfficers[0].effectiveRank;
    const lowestRankCandidates = rankedOfficers.filter((o) => o.effectiveRank === lowestRankNumber);

    // Pick the candidate (if multiple share lowest rank, first or least loaded)
    const selectedOfficer = lowestRankCandidates[0];

    return {
      assignedTo: selectedOfficer._id,
      assignedOfficer: selectedOfficer,
      assignedDesignation: selectedOfficer.designation || getLowestRankDesignation(resolvedDept),
      assignedRank: selectedOfficer.effectiveRank,
      department: resolvedDept,
    };
  }

  // If no approved officer exists in this department/category yet:
  // Route to the canonical lowest rank designation for this department
  const canonicalLowestDesignation = getLowestRankDesignation(resolvedDept);
  const canonicalLowestRank = getLowestRankNumber(resolvedDept);

  return {
    assignedTo: null,
    assignedOfficer: null,
    assignedDesignation: canonicalLowestDesignation,
    assignedRank: canonicalLowestRank,
    department: resolvedDept,
  };
}

/**
 * Returns the canonical designation string for a given department and numeric rank.
 */
function getDesignationForRank(department, rank) {
  if (!department || typeof rank !== "number" || rank < 1) return "";
  const list = DEPARTMENT_DESIGNATIONS[department];
  if (!Array.isArray(list) || list.length === 0) return "";
  const idx = rank - 1;
  return list[idx] || "";
}

/**
 * Resolves the next higher authority in the department hierarchy.
 * In NyayaStack:
 * - Rank 1 is the highest authority (e.g. Dean, Chief Warden, Controller of Exams).
 * - Higher numbers represent lower ranks (e.g. Rank 6 = Caretaker).
 * - A "higher authority" has effectiveRank < currentRank.
 * - We select the immediate next higher rank (maximum effectiveRank strictly less than currentRank).
 * - If no higher authority exists (e.g. already at Rank 1), or no higher authority is configured,
 *   flags for Admin attention.
 */
async function findNextHigherAuthority({
  department,
  category,
  currentRank,
  currentOfficerId,
  UserModel,
}) {
  const resolvedDept = department || CATEGORY_TO_DEPARTMENT[category] || "Administration";
  const deptDesignations = DEPARTMENT_DESIGNATIONS[resolvedDept] || [];

  const effectiveCurrentRank =
    typeof currentRank === "number" && currentRank > 0
      ? currentRank
      : getLowestRankNumber(resolvedDept);

  // If already at Rank 1 (highest level in department), cannot escalate further within department
  if (effectiveCurrentRank <= 1) {
    return {
      hasHigherAuthority: false,
      requiresAdminAttention: true,
      assignedTo: null,
      assignedOfficer: null,
      assignedDesignation: "Office of the Ombudsman / Executive Admin",
      assignedRank: 0,
      department: resolvedDept,
    };
  }

  if (UserModel) {
    const query = {
      role: "officer",
      verificationStatus: "approved",
      isVerified: true,
      department: resolvedDept,
    };

    const officers = await UserModel.find(query).lean();

    const normalizedCat = (category || "").trim().toLowerCase();
    const eligibleOfficers = officers.filter((officer) => {
      if (!officer.category || officer.category.trim() === "" || officer.category.toLowerCase() === "all") {
        return true;
      }
      return officer.category.trim().toLowerCase() === normalizedCat;
    });

    const rankedOfficers = eligibleOfficers.map((officer) => {
      const calcRank = getRankForDesignation(resolvedDept, officer.designation);
      const effectiveRank =
        typeof officer.rank === "number" && officer.rank !== 999 ? officer.rank : calcRank;
      return {
        ...officer,
        effectiveRank,
      };
    });

    // Candidates whose rank is strictly higher than currentRank (i.e. effectiveRank < effectiveCurrentRank)
    const higherCandidates = rankedOfficers.filter((o) => {
      if (o.effectiveRank >= effectiveCurrentRank) return false;
      if (currentOfficerId && String(o._id) === String(currentOfficerId)) return false;
      return true;
    });

    if (higherCandidates.length > 0) {
      // Sort descending by effectiveRank to get the immediate step up (e.g. 5 before 3)
      higherCandidates.sort((a, b) => b.effectiveRank - a.effectiveRank);
      const nextOfficer = higherCandidates[0];

      return {
        hasHigherAuthority: true,
        requiresAdminAttention: false,
        assignedTo: nextOfficer._id,
        assignedOfficer: nextOfficer,
        assignedDesignation:
          nextOfficer.designation || getDesignationForRank(resolvedDept, nextOfficer.effectiveRank),
        assignedRank: nextOfficer.effectiveRank,
        department: resolvedDept,
      };
    }
  }

  // If no higher registered/approved officer is found in DB, check canonical hierarchy for next step
  const nextRankNumber = effectiveCurrentRank - 1;
  const canonicalDesignation = getDesignationForRank(resolvedDept, nextRankNumber);

  if (canonicalDesignation) {
    return {
      hasHigherAuthority: true,
      requiresAdminAttention: false,
      assignedTo: null,
      assignedOfficer: null,
      assignedDesignation: canonicalDesignation,
      assignedRank: nextRankNumber,
      department: resolvedDept,
    };
  }

  // Otherwise, top of hierarchy reached or no higher authority configured -> flag for admin attention
  return {
    hasHigherAuthority: false,
    requiresAdminAttention: true,
    assignedTo: null,
    assignedOfficer: null,
    assignedDesignation: "Office of the Ombudsman / Executive Admin",
    assignedRank: 0,
    department: resolvedDept,
  };
}

module.exports = {
  DEPARTMENT_DESIGNATIONS,
  CATEGORY_TO_DEPARTMENT,
  DEPARTMENT_TO_CATEGORIES,
  getRankForDesignation,
  getLowestRankDesignation,
  getLowestRankNumber,
  getDesignationForRank,
  findLowestRankAuthority,
  findNextHigherAuthority,
};
