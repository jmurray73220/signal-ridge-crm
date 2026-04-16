import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '../.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Signal Ridge CRM database...');

  // --- Admin User ---
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@signalridge.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Jonathan',
      lastName: 'Murray',
      role: 'Admin',
      mustChangePassword: false,
      isActive: true,
    },
  });
  console.log(`Admin user created: ${admin.email}`);

  // --- Entities ---

  // Congressional Offices
  const senateOffice = await prisma.entity.upsert({
    where: { id: 'entity-senate-cornyn' },
    update: {},
    create: {
      id: 'entity-senate-cornyn',
      name: "Office of Sen. John Cornyn",
      entityType: 'CongressionalOffice',
      memberName: "Sen. John Cornyn",
      chamber: 'Senate',
      state: "TX",
      party: 'Republican',
      committee: JSON.stringify(["Senate Armed Services Committee", "Senate Judiciary Committee", "Senate Finance Committee"]),
      subcommittee: JSON.stringify(["SASC Subcommittee on Emerging Threats and Capabilities", "SASC Subcommittee on Airland"]),
      tags: JSON.stringify(["Priority Account", "Appropriations", "Authorization"]),
      description: "Senior Senator from Texas. Member of the Senate Armed Services Committee. Key vote on NDAA authorization.",
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  const houseOffice = await prisma.entity.upsert({
    where: { id: 'entity-house-wittman' },
    update: {},
    create: {
      id: 'entity-house-wittman',
      name: "Office of Rep. Rob Wittman",
      entityType: 'CongressionalOffice',
      memberName: "Rep. Rob Wittman",
      chamber: 'House',
      state: "VA",
      district: "1st",
      party: 'Republican',
      committee: JSON.stringify(["House Armed Services Committee", "House Natural Resources Committee"]),
      subcommittee: JSON.stringify(["HASC Subcommittee on Tactical Air and Land Forces", "HASC Subcommittee on Seapower and Projection Forces"]),
      tags: JSON.stringify(["Priority Account", "Authorization", "FYDP"]),
      description: "Representative for Virginia's 1st Congressional District. Ranking Member on HASC Subcommittee on Tactical Air and Land Forces.",
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  // Government Organizations
  const osdSolic = await prisma.entity.upsert({
    where: { id: 'entity-osd-solic' },
    update: {},
    create: {
      id: 'entity-osd-solic',
      name: "OSD/SO/LIC",
      entityType: 'GovernmentOrganization',
      parentAgency: "Department of Defense",
      subComponent: "Office of the Under Secretary of Defense for Policy",
      governmentType: 'DoD',
      budgetLineItem: "PE 0305206D8Z — Special Operations Command",
      tags: JSON.stringify(["Active Contract", "Priority Account", "FYDP"]),
      description: "Office of the Assistant Secretary of Defense for Special Operations and Low-Intensity Conflict. Primary OSD policy office for SOCOM.",
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  const ussocom = await prisma.entity.upsert({
    where: { id: 'entity-ussocom' },
    update: {},
    create: {
      id: 'entity-ussocom',
      name: "USSOCOM",
      entityType: 'GovernmentOrganization',
      parentAgency: "Department of Defense",
      subComponent: "United States Special Operations Command",
      governmentType: 'DoD',
      budgetLineItem: "MFP-11 — Special Operations Forces",
      tags: JSON.stringify(["Active Contract", "Priority Account"]),
      description: "United States Special Operations Command. MacDill AFB. Unified combatant command responsible for overseeing special operations.",
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  // Companies
  const peraton = await prisma.entity.upsert({
    where: { id: 'entity-peraton' },
    update: {},
    create: {
      id: 'entity-peraton',
      name: "Peraton",
      entityType: 'Company',
      industry: "Defense & Intelligence Contractor",
      contractVehicles: JSON.stringify(["OASIS+", "SEWP VI", "CIO-SP4", "GSA MAS"]),
      website: "https://www.peraton.com",
      tags: JSON.stringify(["Current Client", "Active Contract"]),
      description: "National security contractor supporting missions across the intelligence community, space, cyber, and defense.",
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  const booz = await prisma.entity.upsert({
    where: { id: 'entity-booz' },
    update: {},
    create: {
      id: 'entity-booz',
      name: "Booz Allen Hamilton",
      entityType: 'Company',
      industry: "Management Consulting / Defense",
      contractVehicles: JSON.stringify(["OASIS+", "SEWP VI", "GSA MAS", "IC CAAS"]),
      website: "https://www.boozallen.com",
      tags: JSON.stringify(["Prospect", "Priority Account"]),
      description: "Management and technology consulting firm with major DoD and intelligence community contracts.",
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  console.log('Entities created');

  // --- Contacts ---

  const contacts = await Promise.all([
    // Senate office contacts
    prisma.contact.upsert({
      where: { id: 'contact-cornyn-ld' },
      update: {},
      create: {
        id: 'contact-cornyn-ld',
        firstName: 'Sarah',
        lastName: 'Mitchell',
        title: 'Legislative Director',
        email: 'sarah.mitchell@cornyn.senate.gov',
        officePhone: '202-224-2934',
        tags: JSON.stringify(['Hill Staffer', 'Decision Maker', 'Gatekeeper']),
        entityId: senateOffice.id,
        bio: 'Legislative Director for Sen. Cornyn. Manages all defense and national security portfolio issues. Previously served as professional staff member on SASC.',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.contact.upsert({
      where: { id: 'contact-cornyn-defense' },
      update: {},
      create: {
        id: 'contact-cornyn-defense',
        firstName: 'Marcus',
        lastName: 'Chen',
        title: 'Defense Policy Advisor',
        email: 'marcus.chen@cornyn.senate.gov',
        officePhone: '202-224-2934',
        tags: JSON.stringify(['Hill Staffer', 'Technical POC', 'SITE 525']),
        entityId: senateOffice.id,
        bio: 'Defense policy advisor handling SOCOM, cyber, and emerging technology issues. Primary contact for NDAA matters.',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),

    // House office contacts
    prisma.contact.upsert({
      where: { id: 'contact-wittman-cs' },
      update: {},
      create: {
        id: 'contact-wittman-cs',
        firstName: 'Jennifer',
        lastName: 'Torres',
        title: 'Chief of Staff',
        email: 'jennifer.torres@mail.house.gov',
        officePhone: '202-225-4261',
        tags: JSON.stringify(['Hill Staffer', 'Decision Maker', 'Champion']),
        entityId: houseOffice.id,
        bio: 'Chief of Staff. Manages all office operations and has direct access to the Member on defense priorities.',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.contact.upsert({
      where: { id: 'contact-wittman-hasc' },
      update: {},
      create: {
        id: 'contact-wittman-hasc',
        firstName: 'David',
        lastName: 'Park',
        title: 'HASC Staff Director',
        email: 'david.park@mail.house.gov',
        officePhone: '202-225-4261',
        tags: JSON.stringify(['Hill Staffer', 'Technical POC']),
        entityId: houseOffice.id,
        bio: "Staff director for Rep. Wittman's HASC subcommittee work. Focus on tactical air, land forces, and SOF requirements.",
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),

    // OSD/SOLIC contacts
    prisma.contact.upsert({
      where: { id: 'contact-osd-dasd' },
      update: {},
      create: {
        id: 'contact-osd-dasd',
        firstName: 'Michael',
        lastName: 'Reynolds',
        rank: 'SES',
        title: 'Deputy Assistant Secretary of Defense for Special Operations',
        email: 'm.reynolds@osd.mil',
        officePhone: '703-697-0101',
        tags: JSON.stringify(['SES', 'Decision Maker', 'Program Office']),
        entityId: osdSolic.id,
        bio: 'DASD(SO) responsible for policy oversight of SOCOM and special operations forces worldwide.',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.contact.upsert({
      where: { id: 'contact-osd-pm' },
      update: {},
      create: {
        id: 'contact-osd-pm',
        firstName: 'Patricia',
        lastName: 'Walsh',
        rank: 'COL',
        title: 'Program Manager, SOCOM Liaison',
        email: 'p.walsh@osd.mil',
        officePhone: '703-697-0202',
        tags: JSON.stringify(['Program Office', 'Technical POC', 'Contracting Officer']),
        entityId: osdSolic.id,
        bio: 'Army COL serving as SOCOM liaison officer to OSD/SO/LIC. Manages program coordination and requirements validation.',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),

    // USSOCOM contacts
    prisma.contact.upsert({
      where: { id: 'contact-socom-j8' },
      update: {},
      create: {
        id: 'contact-socom-j8',
        firstName: 'Robert',
        lastName: 'Nakamura',
        rank: 'RDML',
        title: 'J8 Director, Resources and Acquisition',
        email: 'r.nakamura@socom.mil',
        officePhone: '813-826-8000',
        cell: '813-555-0147',
        tags: JSON.stringify(['Flag Officer', 'Decision Maker', 'BD Target']),
        entityId: ussocom.id,
        bio: 'Rear Admiral serving as USSOCOM J8. Controls the MFP-11 budget and acquisition strategy. Key decision maker on major contracts.',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.contact.upsert({
      where: { id: 'contact-socom-sof-at' },
      update: {},
      create: {
        id: 'contact-socom-sof-at',
        firstName: 'Thomas',
        lastName: 'Hargrove',
        rank: 'COL',
        title: 'SOF Acquisition and Technology Program Manager',
        email: 't.hargrove@socom.mil',
        officePhone: '813-826-8100',
        tags: JSON.stringify(['Program Office', 'Technical POC', 'Contracting Officer', 'BD Target']),
        entityId: ussocom.id,
        bio: 'Army Special Forces COL managing SOF AT&L acquisition programs. Technical authority on ISR and C2 systems.',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),

    // Peraton contacts
    prisma.contact.upsert({
      where: { id: 'contact-peraton-bd' },
      update: {},
      create: {
        id: 'contact-peraton-bd',
        firstName: 'Amanda',
        lastName: 'Foster',
        title: 'Vice President, Business Development — DoD',
        email: 'amanda.foster@peraton.com',
        officePhone: '571-203-7000',
        cell: '571-555-0234',
        linkedIn: 'https://linkedin.com/in/amandafoster-peraton',
        tags: JSON.stringify(['BD Target', 'Decision Maker', 'Champion']),
        entityId: peraton.id,
        bio: 'VP of Business Development for DoD accounts. Primary relationship lead for SOCOM and OSD engagements.',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.contact.upsert({
      where: { id: 'contact-peraton-pm' },
      update: {},
      create: {
        id: 'contact-peraton-pm',
        firstName: 'Kevin',
        lastName: 'Sullivan',
        title: 'Program Manager — SOCOM ISR',
        email: 'kevin.sullivan@peraton.com',
        officePhone: '571-203-7100',
        tags: JSON.stringify(['Technical POC']),
        entityId: peraton.id,
        bio: "Program manager for Peraton's SOCOM ISR contract. Day-to-day technical lead.",
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),

    // Booz Allen contacts
    prisma.contact.upsert({
      where: { id: 'contact-booz-svp' },
      update: {},
      create: {
        id: 'contact-booz-svp',
        firstName: 'Carolyn',
        lastName: 'Stevenson',
        title: 'Senior Vice President — Defense',
        email: 'carolyn.stevenson@bah.com',
        officePhone: '703-902-5000',
        linkedIn: 'https://linkedin.com/in/carolyn-stevenson-bah',
        tags: JSON.stringify(['Decision Maker', 'BD Target', 'Champion']),
        entityId: booz.id,
        bio: "SVP leading Booz Allen's defense practice. Primary decision maker on strategic partnerships and teaming arrangements.",
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.contact.upsert({
      where: { id: 'contact-booz-capture' },
      update: {},
      create: {
        id: 'contact-booz-capture',
        firstName: 'James',
        lastName: 'Okafor',
        title: 'Capture Manager — SOCOM Portfolio',
        email: 'james.okafor@bah.com',
        officePhone: '703-902-5100',
        cell: '703-555-0389',
        tags: JSON.stringify(['BD Target', 'Technical POC']),
        entityId: booz.id,
        bio: 'Capture manager focused on SOCOM and SOF requirements. Manages proposal development for AT&L opportunities.',
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.contact.upsert({
      where: { id: 'contact-booz-partner' },
      update: {},
      create: {
        id: 'contact-booz-partner',
        firstName: 'Lisa',
        lastName: 'Drummond',
        title: 'Partner — Federal Government',
        email: 'lisa.drummond@bah.com',
        officePhone: '703-902-5200',
        linkedIn: 'https://linkedin.com/in/lisa-drummond-bah',
        tags: JSON.stringify(['Decision Maker', 'Gatekeeper']),
        entityId: booz.id,
        bio: "Partner in Booz Allen's federal government practice. Strategic advisor on defense and intelligence community contracts.",
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
  ]);

  console.log(`${contacts.length} contacts created`);

  // --- Initiatives ---

  const initiative1 = await prisma.initiative.upsert({
    where: { id: 'init-socom-isr' },
    update: {},
    create: {
      id: 'init-socom-isr',
      title: 'USSOCOM Next-Gen ISR Platform Advocacy',
      description: 'Advocating for increased MFP-11 budget allocation for next-generation ISR platform acquisition. Coordinating between SOCOM J8, OSD/SO/LIC, and key Hill appropriators.',
      status: 'Active',
      priority: 'High',
      startDate: new Date('2024-09-01'),
      targetDate: new Date('2025-06-30'),
      primaryEntityId: ussocom.id,
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  const initiative2 = await prisma.initiative.upsert({
    where: { id: 'init-peraton-oasis' },
    update: {},
    create: {
      id: 'init-peraton-oasis',
      title: 'Peraton OASIS+ Task Order Support',
      description: "Supporting Peraton's pursuit of SOCOM-specific task orders under the OASIS+ vehicle. Facilitating introductions and positioning strategy.",
      status: 'Active',
      priority: 'High',
      startDate: new Date('2024-11-01'),
      targetDate: new Date('2025-04-30'),
      primaryEntityId: peraton.id,
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  const initiative3 = await prisma.initiative.upsert({
    where: { id: 'init-ndaa-sec' },
    update: {},
    create: {
      id: 'init-ndaa-sec',
      title: 'FY26 NDAA SOF Section Markup',
      description: 'Monitoring and influencing FY26 NDAA markup language relevant to SOCOM authorities and funding. Coordinating with SASC and HASC staff.',
      status: 'Active',
      priority: 'High',
      startDate: new Date('2025-01-15'),
      targetDate: new Date('2025-12-31'),
      primaryEntityId: senateOffice.id,
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  const initiative4 = await prisma.initiative.upsert({
    where: { id: 'init-booz-teaming' },
    update: {},
    create: {
      id: 'init-booz-teaming',
      title: 'Booz Allen Teaming Partnership Development',
      description: 'Building a strategic teaming relationship with Booz Allen for joint pursuit of OSD-level advisory contracts.',
      status: 'Pipeline',
      priority: 'Medium',
      startDate: new Date('2025-02-01'),
      targetDate: new Date('2025-09-30'),
      primaryEntityId: booz.id,
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  const initiative5 = await prisma.initiative.upsert({
    where: { id: 'init-osd-cyber' },
    update: {},
    create: {
      id: 'init-osd-cyber',
      title: 'OSD Cyber Policy Briefing Campaign',
      description: 'Coordinating a series of briefings for OSD/SO/LIC leadership on emerging cyber capabilities relevant to SOF operations.',
      status: 'OnHold',
      priority: 'Medium',
      startDate: new Date('2024-10-01'),
      targetDate: new Date('2025-05-31'),
      primaryEntityId: osdSolic.id,
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  const initiative6 = await prisma.initiative.upsert({
    where: { id: 'init-house-mark' },
    update: {},
    create: {
      id: 'init-house-mark',
      title: 'HASC TACAIR Subcommittee Engagement',
      description: "Building relationship with Rep. Wittman's HASC team on tactical air and land forces priorities relevant to SOF aviation.",
      status: 'Pipeline',
      priority: 'Low',
      startDate: new Date('2025-03-01'),
      targetDate: new Date('2025-12-31'),
      primaryEntityId: houseOffice.id,
      createdByUserId: admin.id,
      updatedByUserId: admin.id,
    },
  });

  console.log('Initiatives created');

  // --- Initiative Contacts ---
  await Promise.all([
    // SOCOM ISR Initiative
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative1.id, contactId: 'contact-socom-j8' } },
      update: {},
      create: { initiativeId: initiative1.id, contactId: 'contact-socom-j8', role: 'Sponsor' },
    }),
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative1.id, contactId: 'contact-socom-sof-at' } },
      update: {},
      create: { initiativeId: initiative1.id, contactId: 'contact-socom-sof-at', role: 'Technical POC' },
    }),
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative1.id, contactId: 'contact-osd-dasd' } },
      update: {},
      create: { initiativeId: initiative1.id, contactId: 'contact-osd-dasd', role: 'Champion' },
    }),
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative1.id, contactId: 'contact-cornyn-defense' } },
      update: {},
      create: { initiativeId: initiative1.id, contactId: 'contact-cornyn-defense', role: 'Staffer Lead' },
    }),

    // Peraton OASIS+ Initiative
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative2.id, contactId: 'contact-peraton-bd' } },
      update: {},
      create: { initiativeId: initiative2.id, contactId: 'contact-peraton-bd', role: 'Champion' },
    }),
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative2.id, contactId: 'contact-socom-j8' } },
      update: {},
      create: { initiativeId: initiative2.id, contactId: 'contact-socom-j8', role: 'Gatekeeper' },
    }),

    // NDAA Initiative
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative3.id, contactId: 'contact-cornyn-ld' } },
      update: {},
      create: { initiativeId: initiative3.id, contactId: 'contact-cornyn-ld', role: 'Staffer Lead' },
    }),
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative3.id, contactId: 'contact-cornyn-defense' } },
      update: {},
      create: { initiativeId: initiative3.id, contactId: 'contact-cornyn-defense', role: 'Technical POC' },
    }),
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative3.id, contactId: 'contact-wittman-hasc' } },
      update: {},
      create: { initiativeId: initiative3.id, contactId: 'contact-wittman-hasc', role: 'Staffer Lead' },
    }),
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative3.id, contactId: 'contact-osd-dasd' } },
      update: {},
      create: { initiativeId: initiative3.id, contactId: 'contact-osd-dasd', role: 'End User' },
    }),

    // Booz Allen Initiative
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative4.id, contactId: 'contact-booz-svp' } },
      update: {},
      create: { initiativeId: initiative4.id, contactId: 'contact-booz-svp', role: 'Sponsor' },
    }),
    prisma.initiativeContact.upsert({
      where: { initiativeId_contactId: { initiativeId: initiative4.id, contactId: 'contact-booz-capture' } },
      update: {},
      create: { initiativeId: initiative4.id, contactId: 'contact-booz-capture', role: 'Champion' },
    }),
  ]);

  // --- Initiative Entities (multi-entity links) ---
  await Promise.all([
    // SOCOM ISR spans SOCOM, OSD/SOLIC, and Senate
    prisma.initiativeEntity.upsert({
      where: { initiativeId_entityId: { initiativeId: initiative1.id, entityId: ussocom.id } },
      update: {},
      create: { initiativeId: initiative1.id, entityId: ussocom.id, relationshipNote: 'Primary customer and requirement owner' },
    }),
    prisma.initiativeEntity.upsert({
      where: { initiativeId_entityId: { initiativeId: initiative1.id, entityId: osdSolic.id } },
      update: {},
      create: { initiativeId: initiative1.id, entityId: osdSolic.id, relationshipNote: 'Policy oversight and budget approval' },
    }),
    prisma.initiativeEntity.upsert({
      where: { initiativeId_entityId: { initiativeId: initiative1.id, entityId: senateOffice.id } },
      update: {},
      create: { initiativeId: initiative1.id, entityId: senateOffice.id, relationshipNote: 'SASC authorization authority' },
    }),

    // Peraton OASIS+ spans Peraton and SOCOM
    prisma.initiativeEntity.upsert({
      where: { initiativeId_entityId: { initiativeId: initiative2.id, entityId: peraton.id } },
      update: {},
      create: { initiativeId: initiative2.id, entityId: peraton.id, relationshipNote: 'Prime contractor pursuing task order' },
    }),
    prisma.initiativeEntity.upsert({
      where: { initiativeId_entityId: { initiativeId: initiative2.id, entityId: ussocom.id } },
      update: {},
      create: { initiativeId: initiative2.id, entityId: ussocom.id, relationshipNote: 'Contracting office and end user' },
    }),

    // NDAA spans both Congressional offices and OSD
    prisma.initiativeEntity.upsert({
      where: { initiativeId_entityId: { initiativeId: initiative3.id, entityId: senateOffice.id } },
      update: {},
      create: { initiativeId: initiative3.id, entityId: senateOffice.id, relationshipNote: 'SASC markup authority' },
    }),
    prisma.initiativeEntity.upsert({
      where: { initiativeId_entityId: { initiativeId: initiative3.id, entityId: houseOffice.id } },
      update: {},
      create: { initiativeId: initiative3.id, entityId: houseOffice.id, relationshipNote: 'HASC markup authority' },
    }),
    prisma.initiativeEntity.upsert({
      where: { initiativeId_entityId: { initiativeId: initiative3.id, entityId: osdSolic.id } },
      update: {},
      create: { initiativeId: initiative3.id, entityId: osdSolic.id, relationshipNote: 'DoD equities and congressional justification' },
    }),
  ]);

  console.log('Initiative relationships created');

  // --- Interactions ---
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const interactions = await Promise.all([
    prisma.interaction.create({
      data: {
        id: 'int-001',
        type: 'Meeting',
        date: daysAgo(3),
        subject: 'SOCOM J8 FY26 Budget Strategy Session',
        notes: '## SOCOM J8 Budget Session\n\n**Attendees**: RDML Nakamura, COL Hargrove\n\n**Key Takeaways**:\n- MFP-11 topline under pressure, likely 3-5% cut in FY26 request\n- J8 prioritizing next-gen ISR over legacy platform sustainment\n- RDML Nakamura supportive of our advocacy approach on Hill\n\n**Action Items**:\n- Draft one-pager on ISR gap analysis for SASC staff\n- Schedule follow-on with COL Walsh at OSD/SOLIC\n- Coordinate with Sarah Mitchell on SASC markup timing',
        entityId: ussocom.id,
        initiativeId: initiative1.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-socom-j8' },
            { contactId: 'contact-socom-sof-at' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-002',
        type: 'Call',
        date: daysAgo(7),
        subject: 'SASC Staff Check-in — NDAA SOF Language',
        notes: '## SASC Staff Call\n\n**With**: Marcus Chen (Cornyn defense advisor)\n\n**Discussion**:\n- NDAA markup schedule: subcommittee markup tentatively set for April\n- Marcus flagged concern about SOCOM authorities language in current draft\n- Opportunity to shape section 1202 language with specific amendment\n\n**Next Steps**:\n- Send draft amendment language by EOW\n- Request meeting with LD Sarah Mitchell to elevate\n- Loop in HASC counterpart David Park',
        entityId: senateOffice.id,
        initiativeId: initiative3.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-cornyn-defense' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-003',
        type: 'Meeting',
        date: daysAgo(14),
        subject: 'Peraton BD Strategy Lunch',
        notes: "## Peraton BD Lunch\n\n**With**: Amanda Foster (VP BD)\n\n**Topics**:\n- Peraton seeking OASIS+ task order support for SOCOM ISR requirement\n- Amanda confirmed they are on contract as OASIS+ awardee\n- Looking for introductions to SOCOM J8 contracting shop\n\n**Outcome**: Agreed to facilitate intro meeting with COL Hargrove. Amanda to provide capability brief.",
        entityId: peraton.id,
        initiativeId: initiative2.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-peraton-bd' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-004',
        type: 'Hearing',
        date: daysAgo(21),
        subject: 'SASC Emerging Threats Subcommittee Hearing — SOF Modernization',
        notes: '## SASC Hearing Notes\n\n**Topic**: SOF Modernization and FY26 Budget Request\n\n**Key Testimony**:\n- USSOCOM commander emphasized need for persistent ISR capability\n- OSD/SO/LIC rep pushed back on proposed MILCON cuts at MacDill\n- Cornyn asked three questions on SOCOM budget authority expansion\n\n**Observations**:\n- Marcus Chen present, will brief Sen. Cornyn on hearing highlights\n- Good opportunity to follow up with written questions for the record\n- SASC seems receptive to SOCOM ISR funding increase',
        entityId: senateOffice.id,
        initiativeId: initiative3.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-cornyn-ld' },
            { contactId: 'contact-cornyn-defense' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-005',
        type: 'Meeting',
        date: daysAgo(28),
        subject: 'OSD/SO/LIC Policy Meeting — Cyber Integration',
        notes: '## OSD/SOLIC Meeting\n\n**With**: Michael Reynolds (DASD), Patricia Walsh (COL)\n\n**Agenda**: Cyber capability integration into SOF operational authorities\n\n**Discussion**:\n- DASD Reynolds concerned about Title 10/50 line blurring in proposed cyber framework\n- COL Walsh flagged acquisition timeline issues for cyber toolkit program\n- Briefing campaign on hold pending OGC legal review (est. 60 days)\n\n**Status**: Initiative on hold until legal review complete',
        entityId: osdSolic.id,
        initiativeId: initiative5.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-osd-dasd' },
            { contactId: 'contact-osd-pm' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-006',
        type: 'Email',
        date: daysAgo(35),
        subject: 'Follow-up: Booz Allen Teaming Discussion',
        notes: "Sent follow-up email to Carolyn Stevenson re: teaming discussion from last month's GovCon event.\n\nKey points:\n- Reiterated Signal Ridge value proposition for SOF Hill engagement\n- Proposed 3-way meeting with BAH and potential OSD end-user\n- Carolyn responded positively, forwarded to James Okafor for follow-up\n\nJames set up a follow-on call for next week.",
        entityId: booz.id,
        initiativeId: initiative4.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-booz-svp' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-007',
        type: 'Call',
        date: daysAgo(42),
        subject: 'HASC Staff Introductory Call — Rep. Wittman Office',
        notes: '## HASC Intro Call\n\n**With**: Jennifer Torres (CoS), David Park (HASC staff)\n\n**Context**: Cold outreach via mutual contact at NDIA\n\n**Discussion**:\n- Introduced Signal Ridge and government relations practice\n- Rep. Wittman focused on SOF aviation modernization and TACAIR\n- Jennifer receptive, wants to see white paper on SOF aviation funding gap\n\n**Next Steps**:\n- Draft SOF aviation white paper\n- Request follow-on in-person meeting',
        entityId: houseOffice.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-wittman-cs' },
            { contactId: 'contact-wittman-hasc' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-008',
        type: 'Briefing',
        date: daysAgo(49),
        subject: 'USSOCOM J8 Capability Brief — Peraton ISR Solutions',
        notes: "## Capability Briefing\n\n**Attendees**: COL Hargrove (SOCOM J8), Amanda Foster (Peraton VP), Kevin Sullivan (Peraton PM)\n\n**Facilitated by Signal Ridge**\n\n**Outcomes**:\n- COL Hargrove expressed strong interest in Peraton's persistent ISR package\n- Kevin Sullivan presented technical specs — well received\n- SOCOM will issue an RFI in Q2 to structure requirement\n- Amanda confirmed Peraton will respond\n\n**This is a significant win for the Peraton engagement.**",
        entityId: ussocom.id,
        initiativeId: initiative2.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-socom-sof-at' },
            { contactId: 'contact-peraton-bd' },
            { contactId: 'contact-peraton-pm' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-009',
        type: 'Meeting',
        date: daysAgo(56),
        subject: 'Sarah Mitchell — SASC Authorization Priority Review',
        notes: "Quarterly check-in with Sarah Mitchell, LD for Sen. Cornyn.\n\nKey discussion:\n- SASC markup priorities for FY26: hypersonics, SOF, space\n- SOCOM ISR language likely to move in authorization bill\n- Sarah wants a one-pager on signal ridge clients' specific capabilities tied to ISR requirement\n\nAction: Draft capability summary for LD review.",
        entityId: senateOffice.id,
        initiativeId: initiative1.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-cornyn-ld' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-010',
        type: 'Event',
        date: daysAgo(63),
        subject: 'NDIA SOF Week — Tampa',
        notes: '## NDIA SOF Week\n\nAttended annual NDIA Special Operations Forces Industry Conference in Tampa.\n\n**Key contacts made/reinforced**:\n- RDML Nakamura (J8) — brief hallway conversation, positive\n- Multiple Peraton and BAH reps\n- Introductory meeting with Booz Allen capture manager James Okafor\n\n**Themes from conference**:\n- Persistent ISR top acquisition priority\n- ATAK and C2 ecosystem expansion\n- Budget pressure narrative dominant',
        entityId: ussocom.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-socom-j8' },
            { contactId: 'contact-booz-capture' },
            { contactId: 'contact-peraton-bd' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-011',
        type: 'Call',
        date: daysAgo(70),
        subject: 'OSD Cyber Briefing Campaign — Scoping Call',
        notes: 'Initial scoping call with OSD/SOLIC team to define parameters for cyber briefing campaign.\n\nAgreed on 3-part series:\n1. Cyber-SOF authorities overview\n2. Industry capabilities brief\n3. Legislative strategy session\n\nTimeline pushed due to upcoming OGC review. On hold until Q3.',
        entityId: osdSolic.id,
        initiativeId: initiative5.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-osd-dasd' },
          ],
        },
      },
    }),

    prisma.interaction.create({
      data: {
        id: 'int-012',
        type: 'Meeting',
        date: daysAgo(77),
        subject: 'Booz Allen Partnership Scoping — Initial Meeting',
        notes: '## BAH Partnership Meeting\n\n**Attendees**: Carolyn Stevenson (SVP), James Okafor (Capture Mgr), Lisa Drummond (Partner)\n\n**Purpose**: Explore teaming on OSD advisory requirement\n\n**Key Points**:\n- BAH has incumbent on adjacent OSD advisory contract, expiring FY26\n- Signal Ridge could provide Hill engagement component\n- Lisa Drummond interested in formal teaming agreement\n\n**Potential**: 2-year engagement, significant value to both parties.',
        entityId: booz.id,
        initiativeId: initiative4.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
        contacts: {
          create: [
            { contactId: 'contact-booz-svp' },
            { contactId: 'contact-booz-capture' },
            { contactId: 'contact-booz-partner' },
          ],
        },
      },
    }),
  ]);

  console.log(`${interactions.length} interactions created`);

  // --- Tasks ---
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        id: 'task-001',
        title: 'Draft ISR gap analysis one-pager for SASC staff (Sarah Mitchell)',
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        completed: false,
        contactId: 'contact-cornyn-ld',
        initiativeId: initiative1.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.task.create({
      data: {
        id: 'task-002',
        title: 'Schedule intro meeting: Peraton Amanda Foster + COL Hargrove (SOCOM J8)',
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        completed: false,
        contactId: 'contact-peraton-bd',
        initiativeId: initiative2.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.task.create({
      data: {
        id: 'task-003',
        title: 'Draft NDAA Section 1202 amendment language',
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        completed: false,
        contactId: 'contact-cornyn-defense',
        initiativeId: initiative3.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.task.create({
      data: {
        id: 'task-004',
        title: 'Send SOF aviation white paper to Jennifer Torres (Wittman CoS)',
        dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        completed: false,
        contactId: 'contact-wittman-cs',
        entityId: houseOffice.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.task.create({
      data: {
        id: 'task-005',
        title: 'Follow up with James Okafor on BAH teaming agreement draft',
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        completed: false,
        contactId: 'contact-booz-capture',
        initiativeId: initiative4.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.task.create({
      data: {
        id: 'task-006',
        title: 'Confirm OGC review timeline with COL Walsh',
        dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days overdue
        completed: false,
        contactId: 'contact-osd-pm',
        initiativeId: initiative5.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.task.create({
      data: {
        id: 'task-007',
        title: 'Prepare capability summary for Sarah Mitchell (LD) review',
        dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
        completed: false,
        contactId: 'contact-cornyn-ld',
        initiativeId: initiative1.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.task.create({
      data: {
        id: 'task-008',
        title: 'Request in-person meeting with Rep. Wittman office',
        dueDate: null,
        completed: false,
        entityId: houseOffice.id,
        initiativeId: initiative6.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
    prisma.task.create({
      data: {
        id: 'task-009',
        title: 'COMPLETE: Facilitate Peraton-SOCOM capability briefing',
        dueDate: new Date(now.getTime() - 49 * 24 * 60 * 60 * 1000),
        completed: true,
        entityId: peraton.id,
        initiativeId: initiative2.id,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    }),
  ]);

  console.log(`${tasks.length} tasks created`);

  // --- Default Report Template ---
  const templatePaths = [
    '/mnt/user-data/uploads/SITE525__FY26_Potential_Opportunities_1_21_26.docx',
    path.resolve(__dirname, '../../SITE525__FY26_Potential_Opportunities_1_21_26.docx'),
    path.resolve(__dirname, '../../../SITE525__FY26_Potential_Opportunities_1_21_26.docx'),
  ];

  let templateSeeded = false;
  for (const templatePath of templatePaths) {
    if (fs.existsSync(templatePath)) {
      const fileData = fs.readFileSync(templatePath).toString('base64');
      await prisma.reportTemplate.upsert({
        where: { id: 'default-srs-template' },
        update: {},
        create: {
          id: 'default-srs-template',
          name: 'SRS Standard Report',
          description: 'Default Signal Ridge Strategies report template.',
          fileData,
        },
      });
      console.log(`Default report template seeded from: ${templatePath}`);
      templateSeeded = true;
      break;
    }
  }
  if (!templateSeeded) {
    console.log('Default report template file not found — skipping template seed.');
    console.log('Place SITE525__FY26_Potential_Opportunities_1_21_26.docx in the project root or /mnt/user-data/uploads/ and re-run seed.');
  }

  console.log('\nSignal Ridge CRM seed complete!');
  console.log(`\nAdmin login: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
