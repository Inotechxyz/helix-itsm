/**
 * Helix Helpdesk Database Seeder
 *
 * This file seeds the database with sample data for development and testing.
 * All functions are idempotent and can be run multiple times safely.
 *
 * Usage:
 *   npm run db:seed -w apps/api    # Run all seed data
 *   npm run db:seed -w apps/api -- --orgs  # Include multi-org seed
 *   npm run db:seed -w apps/api -- --fix    # Include data fixes
 *
 * Run individually with ts-node:
 *   npx ts-node prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const includeOrgs = args.includes('--orgs') || args.includes('--all');
const includeFixes = args.includes('--fix') || args.includes('--all');

// ============================================
// SECTION 0: DEFAULT ORGANIZATION
// ============================================

async function seedDefaultOrganization() {
  console.log('\n🏢 Creating Default Organization...');

  const defaultOrg = await prisma.organization.upsert({
    where: { slug: 'default-org' },
    update: {},
    create: {
      name: 'Default Organization',
      slug: 'default-org',
      status: 'active',
      maxUsers: 100,
      primaryColor: '#0066CC',
    },
  });
  console.log(`  ✓ Created organization: ${defaultOrg.name}`);

  return defaultOrg;
}

// ============================================
// SECTION 1: BASE DATA (Users, Teams, Categories)
// ============================================

async function seedBaseData(organizationId: string) {
  console.log('\n📦 Seeding base data...');

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@helix.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'superadmin',
      authProvider: 'local',
      isActive: true,
    },
  });
  console.log(`  ✓ Admin user: ${admin.email}`);

  // Link superadmin to Default Organization
  await prisma.organizationUser.upsert({
    where: {
      organizationId_userId: {
        organizationId: organizationId,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      organizationId: organizationId,
      userId: admin.id,
      orgRole: 'orgadmin',
    },
  });
  console.log(`  ✓ Linked admin to Default Organization`);

  // Create sample users
  // Note: UserRole enum only has 'user' and 'superadmin', so we use 'user' for all sample users
  const users = [
    { email: 'john.smith@helix.local', firstName: 'John', lastName: 'Smith', role: 'user', jobTitle: 'IT Manager', department: 'IT', userType: 'manager' as const },
    { email: 'sarah.johnson@helix.local', firstName: 'Sarah', lastName: 'Johnson', role: 'user', jobTitle: 'Support Agent', department: 'IT', userType: 'agent' as const },
    { email: 'mike.wilson@helix.local', firstName: 'Mike', lastName: 'Wilson', role: 'user', jobTitle: 'Support Agent', department: 'IT', userType: 'agent' as const },
    { email: 'emily.davis@helix.local', firstName: 'Emily', lastName: 'Davis', role: 'user', jobTitle: 'IT Director', department: 'IT', userType: 'approver' as const },
    { email: 'david.brown@helix.local', firstName: 'David', lastName: 'Brown', role: 'user', jobTitle: 'Software Engineer', department: 'Engineering', userType: 'requester' as const },
    { email: 'lisa.anderson@helix.local', firstName: 'Lisa', lastName: 'Anderson', role: 'user', jobTitle: 'Marketing Manager', department: 'Marketing', userType: 'requester' as const },
    { email: 'james.taylor@helix.local', firstName: 'James', lastName: 'Taylor', role: 'user', jobTitle: 'Sales Representative', department: 'Sales', userType: 'requester' as const },
    { email: 'jennifer.martinez@helix.local', firstName: 'Jennifer', lastName: 'Martinez', role: 'user', jobTitle: 'HR Specialist', department: 'HR', userType: 'requester' as const },
  ];

  const createdUsers = [];
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role as any,
        jobTitle: userData.jobTitle,
        department: userData.department,
        password: hashedPassword,
        authProvider: 'local',
        isActive: true,
      },
    });
    createdUsers.push(user);
  }
  console.log(`  ✓ Created ${users.length} sample users`);

  const emily = createdUsers.find(u => u.email === 'emily.davis@helix.local');

  // Create teams
  const teams = [
    { name: 'First Line Support', type: 'first_line', description: 'Initial point of contact for all IT issues' },
    { name: 'Technical Support', type: 'second_line', description: 'Handles complex technical issues requiring expertise' },
    { name: 'Development', type: 'third_line', description: 'Development team for custom solutions and fixes' },
    { name: 'Network Team', type: 'second_line', description: 'Manages network infrastructure and connectivity' },
    { name: 'Security Team', type: 'third_line', description: 'Handles security incidents and access requests' },
  ];

  const createdTeams = [];
  for (let i = 0; i < teams.length; i++) {
    // Check if team already exists with organization
    const existingTeam = await prisma.team.findFirst({
      where: { name: teams[i].name, organizationId: organizationId },
    });
    let team;
    if (existingTeam) {
      team = existingTeam;
    } else {
      team = await prisma.team.create({
        data: {
          name: teams[i].name,
          type: teams[i].type as any,
          description: teams[i].description,
          isActive: true,
          leadId: i < 2 ? createdUsers[i + 1]?.id : null,
          organizationId: organizationId,
        },
      });
    }
    createdTeams.push(team);
  }
  console.log(`  ✓ Created ${teams.length} teams`);

  // Assign users to teams
  const teamAssignments = [
    { userEmail: 'sarah.johnson@helix.local', teamName: 'First Line Support', isPrimary: true },
    { userEmail: 'sarah.johnson@helix.local', teamName: 'Technical Support', isPrimary: false },
    { userEmail: 'mike.wilson@helix.local', teamName: 'First Line Support', isPrimary: true },
    { userEmail: 'mike.wilson@helix.local', teamName: 'Network Team', isPrimary: false },
    { userEmail: 'john.smith@helix.local', teamName: 'Technical Support', isPrimary: true },
    { userEmail: 'john.smith@helix.local', teamName: 'Security Team', isPrimary: false },
    { userEmail: 'emily.davis@helix.local', teamName: 'Security Team', isPrimary: true },
  ];

  for (const assignment of teamAssignments) {
    const user = createdUsers.find(u => u.email === assignment.userEmail);
    const team = createdTeams.find(t => t.name === assignment.teamName);
    if (user && team) {
      await prisma.userTeam.upsert({
        where: { userId_teamId: { userId: user.id, teamId: team.id } },
        update: { isPrimary: assignment.isPrimary },
        create: {
          userId: user.id,
          teamId: team.id,
          isPrimary: assignment.isPrimary,
        },
      });
    }
  }
  console.log(`  ✓ Assigned users to teams`);

  // Create ticket categories
  const ticketCategories = [
    { name: 'Hardware', description: 'Hardware related issues', sortOrder: 1 },
    { name: 'Software', description: 'Software installation and issues', sortOrder: 2 },
    { name: 'Network', description: 'Network and connectivity issues', sortOrder: 3 },
    { name: 'Access', description: 'Access and permission requests', sortOrder: 4 },
    { name: 'Email', description: 'Email and communication issues', sortOrder: 5 },
    { name: 'Security', description: 'Security incidents and concerns', sortOrder: 6 },
  ];

  const createdCategories = [];
  for (const cat of ticketCategories) {
    const categoryId = `${organizationId.slice(0, 8)}-${cat.name.toLowerCase().replace(/\s+/g, '-')}`;
    const category = await prisma.category.upsert({
      where: { id: categoryId },
      update: {},
      create: {
        id: categoryId,
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
        isActive: true,
        organizationId: organizationId,
      },
    });
    createdCategories.push(category);
  }

  // Add subcategories
  const subcategories = [
    { name: 'Laptop Issues', parentName: 'Hardware', sortOrder: 1 },
    { name: 'Printer Issues', parentName: 'Hardware', sortOrder: 2 },
    { name: 'Monitor Issues', parentName: 'Hardware', sortOrder: 3 },
    { name: 'Application Errors', parentName: 'Software', sortOrder: 1 },
    { name: 'Installation Requests', parentName: 'Software', sortOrder: 2 },
    { name: 'License Requests', parentName: 'Software', sortOrder: 3 },
    { name: 'VPN Issues', parentName: 'Network', sortOrder: 1 },
    { name: 'WiFi Issues', parentName: 'Network', sortOrder: 2 },
    { name: 'VPN Access', parentName: 'Access', sortOrder: 1 },
    { name: 'System Access', parentName: 'Access', sortOrder: 2 },
    { name: 'Email Not Working', parentName: 'Email', sortOrder: 1 },
    { name: 'Spam/Phishing', parentName: 'Security', sortOrder: 1 },
  ];

  for (const subcat of subcategories) {
    const parent = createdCategories.find(c => c.name === subcat.parentName);
    if (parent) {
      const subcatId = `${organizationId.slice(0, 8)}-${subcat.name.toLowerCase().replace(/\s+/g, '-')}`;
      await prisma.category.upsert({
        where: { id: subcatId },
        update: {},
        create: {
          id: subcatId,
          name: subcat.name,
          description: subcat.name,
          sortOrder: subcat.sortOrder,
          isActive: true,
          parentId: parent.id,
          organizationId: organizationId,
        },
      });
    }
  }
  console.log(`  ✓ Created ${ticketCategories.length} ticket categories with subcategories`);

  return { admin, users: createdUsers, teams: createdTeams, categories: createdCategories, emily, organizationId };
}

// ============================================
// SECTION 2: KNOWLEDGE BASE (Articles & Categories)
// ============================================

async function seedKnowledgeBase(organizationId: string) {
  console.log('\n📚 Seeding knowledge base...');

  // Article categories
  const articleCategories = [
    { name: 'Getting Started', slug: 'getting-started', description: 'Guides for new users', icon: 'rocket', color: '#22c55e', sortOrder: 1 },
    { name: 'Account & Access', slug: 'account-access', description: 'Account management guides', icon: 'user', color: '#3b82f6', sortOrder: 2 },
    { name: 'Software & Applications', slug: 'software-apps', description: 'How to use company software', icon: 'monitor', color: '#8b5cf6', sortOrder: 3 },
    { name: 'Network & Connectivity', slug: 'network', description: 'Network and VPN guides', icon: 'wifi', color: '#06b6d4', sortOrder: 4 },
    { name: 'Hardware', slug: 'hardware', description: 'Hardware setup and troubleshooting', icon: 'laptop', color: '#f97316', sortOrder: 5 },
    { name: 'Security', slug: 'security', description: 'Security best practices', icon: 'shield', color: '#ef4444', sortOrder: 6 },
  ];

  const createdArticleCategories = [];
  for (const cat of articleCategories) {
    // Check if article category already exists with organization
    const existingCategory = await prisma.articleCategory.findFirst({
      where: { slug: cat.slug, organizationId: organizationId },
    });
    let category;
    if (existingCategory) {
      category = existingCategory;
    } else {
      category = await prisma.articleCategory.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          icon: cat.icon,
          color: cat.color,
          sortOrder: cat.sortOrder,
          isActive: true,
          organizationId: organizationId,
        },
      });
    }
    createdArticleCategories.push(category);
  }
  console.log(`  ✓ Created ${articleCategories.length} article categories`);

  // Knowledge base articles
  const articles = [
    {
      title: 'Welcome to IT Helpdesk',
      slug: 'welcome-to-it-helpdesk',
      categorySlug: 'getting-started',
      content: `# Welcome to IT Helpdesk

Welcome to the company IT Helpdesk! This guide will help you get started with all your IT needs.

## How to Submit a Request

1. Visit the IT Helpdesk portal
2. Click on "New Ticket" or browse our Service Catalog
3. Fill in the required details
4. Submit and track your request

## Quick Links

- **Knowledge Base**: Browse helpful articles
- **Service Catalog**: Request IT services
- **Report an Issue**: Submit a bug or incident`,
    },
    {
      title: 'How to Reset Your Password',
      slug: 'how-to-reset-password',
      categorySlug: 'account-access',
      content: `# How to Reset Your Password

Forgot your password? Here's how to reset it.

## Self-Service Password Reset

1. Go to the login page
2. Click "Forgot Password"
3. Enter your email address
4. Check your email for reset instructions
5. Create a new password

## Password Requirements

Your new password must:
- Be at least 12 characters long
- Include uppercase and lowercase letters
- Include at least one number
- Include at least one special character`,
    },
    {
      title: 'Setting Up VPN Access',
      slug: 'setting-up-vpn-access',
      categorySlug: 'network',
      content: `# Setting Up VPN Access

VPN (Virtual Private Network) allows you to securely connect to the company network from remote locations.

## Prerequisites

- Active company email account
- IT-approved device
- VPN access approval

## Installation Steps

1. Download the VPN client from the software portal
2. Install the application
3. Open the VPN client
4. Enter server address: vpn.company.com
5. Use your company credentials to connect`,
    },
  ];

  const adminUser = await prisma.user.findUnique({ where: { email: process.env.ADMIN_EMAIL || 'admin@helix.local' } });

  for (const article of articles) {
    const category = createdArticleCategories.find(c => c.slug === article.categorySlug);
    if (category && adminUser) {
      const existingArticle = await prisma.article.findFirst({
        where: { slug: article.slug, organizationId: organizationId },
      });
      if (!existingArticle) {
        await prisma.article.create({
          data: {
            title: article.title,
            slug: article.slug,
            content: article.content,
            summary: article.content.substring(0, 150) + '...',
            status: 'published',
            categoryId: category.id,
            createdById: adminUser.id,
            publishedAt: new Date(),
            organizationId: organizationId,
          },
        });
      }
    }
  }
  console.log(`  ✓ Created ${articles.length} knowledge base articles`);

  return createdArticleCategories;
}

// ============================================
// SECTION 3: SERVICE CATALOG
// ============================================

async function seedServices(organizationId: string) {
  console.log('\n🛒 Seeding service catalog...');

  // Service categories
  const serviceCategories = [
    { name: 'IT Services', slug: 'it-services', description: 'Standard IT service requests', icon: 'server', color: '#3b82f6', sortOrder: 1 },
    { name: 'Software', slug: 'software', description: 'Software licenses and installations', icon: 'download', color: '#8b5cf6', sortOrder: 2 },
    { name: 'Hardware', slug: 'hardware', description: 'Hardware requests', icon: 'package', color: '#f97316', sortOrder: 3 },
    { name: 'Access & Permissions', slug: 'access-permissions', description: 'Access to systems and applications', icon: 'key', color: '#22c55e', sortOrder: 4 },
    { name: 'Communication', slug: 'communication', description: 'Email and communication services', icon: 'mail', color: '#06b6d4', sortOrder: 5 },
  ];

  const createdServiceCategories = [];
  for (const cat of serviceCategories) {
    const serviceCatId = `${organizationId.slice(0, 8)}-${cat.slug}`;
    const category = await prisma.serviceCategory.upsert({
      where: { id: serviceCatId },
      update: {},
      create: {
        id: serviceCatId,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isActive: true,
        organizationId: organizationId,
      },
    });
    createdServiceCategories.push(category);
  }
  console.log(`  ✓ Created ${serviceCategories.length} service categories`);

  // Services
  const services = [
    { name: 'New Employee Onboarding', slug: 'new-employee-onboarding', shortDescription: 'Complete setup for new team members', categorySlug: 'it-services', slaHours: 24, requiresApproval: true },
    { name: 'Software Installation', slug: 'software-installation', shortDescription: 'Request software installation', categorySlug: 'software', slaHours: 8, requiresApproval: true },
    { name: 'VPN Access', slug: 'vpn-access', shortDescription: 'Get remote access to company network', categorySlug: 'access-permissions', slaHours: 4, requiresApproval: true },
    { name: 'Password Reset', slug: 'password-reset', shortDescription: 'Reset your account password', categorySlug: 'it-services', slaHours: 2, requiresApproval: false, autoFulfill: true },
    { name: 'New Laptop Request', slug: 'new-laptop-request', shortDescription: 'Request a new laptop', categorySlug: 'hardware', slaHours: 48, requiresApproval: true },
    { name: 'Email Distribution List', slug: 'email-distribution-list', shortDescription: 'Create or modify distribution list', categorySlug: 'communication', slaHours: 8, requiresApproval: true },
    { name: 'Microsoft 365 License', slug: 'microsoft-365-license', shortDescription: 'Request Microsoft 365 license', categorySlug: 'software', slaHours: 4, requiresApproval: true },
    { name: 'Conference Room Setup', slug: 'conference-room-setup', shortDescription: 'Setup meeting room equipment', categorySlug: 'it-services', slaHours: 12, requiresApproval: false },
    { name: 'Cloud Storage Access', slug: 'cloud-storage-access', shortDescription: 'Access to shared cloud storage', categorySlug: 'access-permissions', slaHours: 8, requiresApproval: true },
    { name: 'Mobile Device Setup', slug: 'mobile-device-setup', shortDescription: 'Setup company email on mobile', categorySlug: 'it-services', slaHours: 4, requiresApproval: false, autoFulfill: true },
  ];

  const firstLineTeam = await prisma.team.findFirst({ where: { name: 'First Line Support' } });

  for (const service of services) {
    const category = createdServiceCategories.find(c => c.slug === service.categorySlug);
    if (category) {
      const serviceId = `${organizationId.slice(0, 8)}-${service.slug}`;
      await prisma.service.upsert({
        where: { id: serviceId },
        update: {},
        create: {
          id: serviceId,
          name: service.name,
          slug: service.slug,
          shortDescription: service.shortDescription,
          description: service.shortDescription,
          categoryId: category.id,
          price: 0,
          deliveryTimeDays: service.slaHours / 8,
          requiresApproval: service.requiresApproval,
          autoFulfill: (service as any).autoFulfill || false,
          slaHours: service.slaHours,
          status: 'active',
          assignedTeamId: firstLineTeam?.id,
          organizationId: organizationId,
        },
      });
    }
  }
  console.log(`  ✓ Created ${services.length} services`);

  return createdServiceCategories;
}

// ============================================
// SECTION 4: ASSET MANAGEMENT (CMDB)
// ============================================

async function seedAssets(organizationId: string) {
  console.log('\n🖥️ Seeding assets...');

  // Asset types
  const assetTypes = [
    { name: 'Server', slug: 'server', description: 'Physical and virtual servers', icon: 'server', color: '#3b82f6', sortOrder: 1 },
    { name: 'Laptop', slug: 'laptop', description: 'Laptop computers', icon: 'monitor', color: '#8b5cf6', sortOrder: 2 },
    { name: 'Desktop', slug: 'desktop', description: 'Desktop computers', icon: 'monitor', color: '#ec4899', sortOrder: 3 },
    { name: 'Network Device', slug: 'network-device', description: 'Switches, routers, firewalls', icon: 'wifi', color: '#22c55e', sortOrder: 4 },
    { name: 'Cloud Resource', slug: 'cloud-resource', description: 'Cloud VMs and services', icon: 'cloud', color: '#06b6d4', sortOrder: 5 },
    { name: 'Printer', slug: 'printer', description: 'Printers and scanners', icon: 'package', color: '#f97316', sortOrder: 6 },
    { name: 'Monitor', slug: 'monitor', description: 'Display monitors', icon: 'monitor', color: '#eab308', sortOrder: 7 },
    { name: 'Software License', slug: 'software-license', description: 'Software licenses', icon: 'package', color: '#ef4444', sortOrder: 8 },
  ];

  const createdAssetTypes = [];
  for (const type of assetTypes) {
    const assetTypeId = `${organizationId.slice(0, 8)}-${type.slug}`;
    const assetType = await prisma.assetType.upsert({
      where: { id: assetTypeId },
      update: {},
      create: {
        id: assetTypeId,
        name: type.name,
        slug: type.slug,
        description: type.description,
        icon: type.icon,
        color: type.color,
        sortOrder: type.sortOrder,
        isActive: true,
        organizationId: organizationId,
      },
    });
    createdAssetTypes.push(assetType);
  }
  console.log(`  ✓ Created ${assetTypes.length} asset types`);

  const serverType = createdAssetTypes.find(t => t.slug === 'server')!;
  const laptopType = createdAssetTypes.find(t => t.slug === 'laptop')!;
  const networkType = createdAssetTypes.find(t => t.slug === 'network-device')!;
  const cloudType = createdAssetTypes.find(t => t.slug === 'cloud-resource')!;
  const desktopType = createdAssetTypes.find(t => t.slug === 'desktop')!;

  const sarahUser = await prisma.user.findUnique({ where: { email: 'sarah.johnson@helix.local' } });
  const mikeUser = await prisma.user.findUnique({ where: { email: 'mike.wilson@helix.local' } });
  const davidUser = await prisma.user.findUnique({ where: { email: 'david.brown@helix.local' } });
  const jamesUser = await prisma.user.findUnique({ where: { email: 'james.taylor@helix.local' } });

  const assets = [
    // Servers
    { name: 'DC-01 - Primary Domain Controller', assetTag: 'SRV-001', serialNumber: 'DELL-SRV-2024-001', typeId: serverType.id, status: 'active', manufacturer: 'Dell', model: 'PowerEdge R750', vendor: 'Dell Direct', purchaseDate: new Date('2024-01-15'), purchaseCost: 8500, warrantyExpiry: new Date('2027-01-15'), location: 'Building A, Server Room', department: 'IT', hostname: 'dc-01.helix.local', ipAddress: '192.168.1.10', ciClass: 'server', businessCriticality: 'critical', riskLevel: 'critical' },
    { name: 'FILE-01 - File Server', assetTag: 'SRV-002', serialNumber: 'DELL-SRV-2024-002', typeId: serverType.id, status: 'active', manufacturer: 'Dell', model: 'PowerEdge R650', vendor: 'Dell Direct', purchaseDate: new Date('2024-02-20'), purchaseCost: 6200, warrantyExpiry: new Date('2027-02-20'), location: 'Building A, Server Room', department: 'IT', hostname: 'file-01.helix.local', ipAddress: '192.168.1.11', ciClass: 'server', businessCriticality: 'high', riskLevel: 'medium' },
    { name: 'WEB-01 - Web Server', assetTag: 'SRV-003', serialNumber: 'HP-SRV-2023-015', typeId: serverType.id, status: 'active', manufacturer: 'HP', model: 'ProLiant DL380 Gen10', vendor: 'HP Direct', purchaseDate: new Date('2023-06-10'), purchaseCost: 5500, warrantyExpiry: new Date('2026-06-10'), location: 'Building A, Server Room', department: 'IT', hostname: 'web-01.helix.local', ipAddress: '192.168.1.12', ciClass: 'application', businessCriticality: 'high', riskLevel: 'medium' },
    { name: 'DB-01 - Database Server', assetTag: 'SRV-004', serialNumber: 'DELL-SRV-2024-003', typeId: serverType.id, status: 'active', manufacturer: 'Dell', model: 'PowerEdge R740', vendor: 'Dell Direct', purchaseDate: new Date('2024-03-05'), purchaseCost: 12000, warrantyExpiry: new Date('2029-03-05'), location: 'Building A, Server Room', department: 'IT', hostname: 'db-01.helix.local', ipAddress: '192.168.1.13', ciClass: 'database', businessCriticality: 'critical', riskLevel: 'critical' },
    { name: 'BACKUP-01 - Backup Server', assetTag: 'SRV-005', serialNumber: 'DELL-SRV-2023-008', typeId: serverType.id, status: 'active', manufacturer: 'Dell', model: 'PowerEdge R640', vendor: 'Dell Direct', purchaseDate: new Date('2023-08-22'), purchaseCost: 4800, warrantyExpiry: new Date('2026-08-22'), location: 'Building A, Server Room', department: 'IT', hostname: 'backup-01.helix.local', ipAddress: '192.168.1.14', ciClass: 'server', businessCriticality: 'high', riskLevel: 'medium' },
    // Network Devices
    { name: 'SW-CORE-01 - Core Switch', assetTag: 'NET-001', serialNumber: 'CISCO-SW-2023-001', typeId: networkType.id, status: 'active', manufacturer: 'Cisco', model: 'Catalyst 9300', vendor: 'Cisco Direct', purchaseDate: new Date('2023-04-15'), purchaseCost: 12500, warrantyExpiry: new Date('2028-04-15'), location: 'Building A, Server Room', department: 'IT', hostname: 'sw-core-01', ipAddress: '192.168.1.2', ciClass: 'network', businessCriticality: 'critical', riskLevel: 'critical' },
    { name: 'FW-01 - Perimeter Firewall', assetTag: 'NET-002', serialNumber: 'PFSENSE-FW-2024-001', typeId: networkType.id, status: 'active', manufacturer: 'Fortinet', model: 'FortiGate 600E', vendor: 'Fortinet', purchaseDate: new Date('2024-01-10'), purchaseCost: 8000, warrantyExpiry: new Date('2027-01-10'), location: 'Building A, Server Room', department: 'IT', hostname: 'fw-01', ipAddress: '192.168.1.1', ciClass: 'security', businessCriticality: 'critical', riskLevel: 'critical' },
    { name: 'SW-FLR-1A - Floor Switch 1A', assetTag: 'NET-003', serialNumber: 'CISCO-SW-2023-002', typeId: networkType.id, status: 'active', manufacturer: 'Cisco', model: 'Catalyst 2960X', vendor: 'Cisco Direct', purchaseDate: new Date('2023-05-20'), purchaseCost: 2200, warrantyExpiry: new Date('2026-05-20'), location: 'Building A, Floor 1', department: 'IT', hostname: 'sw-1a-01', ipAddress: '192.168.1.20', ciClass: 'network', businessCriticality: 'moderate', riskLevel: 'low' },
    // Laptops
    { name: 'Sarah Johnson - Dell XPS 15', assetTag: 'LAP-001', serialNumber: 'DELL-XPS-2024-001', typeId: laptopType.id, status: 'active', manufacturer: 'Dell', model: 'XPS 15 9530', assignedToId: sarahUser?.id, purchaseDate: new Date('2024-02-01'), purchaseCost: 1899, warrantyExpiry: new Date('2026-02-01'), location: 'Building A, Floor 2', department: 'IT', operatingSystem: 'Windows 11 Pro', ciClass: 'endpoint', businessCriticality: 'moderate', riskLevel: 'low' },
    { name: 'Mike Wilson - MacBook Pro', assetTag: 'LAP-002', serialNumber: 'APPLE-MBP-2024-001', typeId: laptopType.id, status: 'active', manufacturer: 'Apple', model: 'MacBook Pro 14"', assignedToId: mikeUser?.id, purchaseDate: new Date('2024-03-15'), purchaseCost: 2499, warrantyExpiry: new Date('2026-03-15'), location: 'Building A, Floor 2', department: 'IT', operatingSystem: 'macOS Sonoma', ciClass: 'endpoint', businessCriticality: 'moderate', riskLevel: 'low' },
    { name: 'David Brown - ThinkPad X1', assetTag: 'LAP-003', serialNumber: 'LENOVO-X1-2023-001', typeId: laptopType.id, status: 'active', manufacturer: 'Lenovo', model: 'ThinkPad X1 Carbon Gen 11', assignedToId: davidUser?.id, purchaseDate: new Date('2023-11-10'), purchaseCost: 1649, warrantyExpiry: new Date('2026-11-10'), location: 'Building B, Floor 1', department: 'Engineering', operatingSystem: 'Windows 11 Pro', ciClass: 'endpoint', businessCriticality: 'moderate', riskLevel: 'low' },
    { name: 'James Taylor - HP EliteBook', assetTag: 'LAP-004', serialNumber: 'HP-ELITE-2024-001', typeId: laptopType.id, status: 'under_maintenance', manufacturer: 'HP', model: 'EliteBook 840 G10', assignedToId: jamesUser?.id, purchaseDate: new Date('2024-01-20'), purchaseCost: 1399, warrantyExpiry: new Date('2027-01-20'), location: 'Building C, Floor 1', department: 'Sales', operatingSystem: 'Windows 11 Pro', notes: 'Screen flickering issue - sent for repair', ciClass: 'endpoint', businessCriticality: 'low', riskLevel: 'low' },
    // Cloud Resources
    { name: 'AWS-PROD-API - Production API', assetTag: 'CLD-001', typeId: cloudType.id, status: 'active', manufacturer: 'AWS', vendor: 'Amazon Web Services', purchaseCost: 2500, department: 'IT', hostname: 'prod-api.helix.cloud', ipAddress: '10.0.1.100', ciClass: 'cloud', businessCriticality: 'high', riskLevel: 'high' },
    { name: 'AWS-PROD-WEB - Production Web', assetTag: 'CLD-002', typeId: cloudType.id, status: 'active', manufacturer: 'AWS', vendor: 'Amazon Web Services', purchaseCost: 1800, department: 'IT', hostname: 'prod-web.helix.cloud', ipAddress: '10.0.1.101', ciClass: 'cloud', businessCriticality: 'high', riskLevel: 'high' },
    // Desktops
    { name: 'Reception Desk - Dell OptiPlex', assetTag: 'DESK-001', serialNumber: 'DELL-OPT-2023-005', typeId: desktopType.id, status: 'active', manufacturer: 'Dell', model: 'OptiPlex 7010', purchaseDate: new Date('2023-09-01'), purchaseCost: 899, warrantyExpiry: new Date('2026-09-01'), location: 'Building A, Reception', department: 'Admin', operatingSystem: 'Windows 11 Pro', ciClass: 'endpoint', businessCriticality: 'low', riskLevel: 'low' },
  ];

  const createdAssets = [];
  for (const asset of assets) {
    const existing = await prisma.asset.findFirst({
      where: { assetTag: asset.assetTag, organizationId: organizationId },
    });

    const created = await prisma.asset.upsert({
      where: { id: existing?.id || '' },
      update: {},
      create: {
        name: asset.name,
        assetTag: asset.assetTag,
        serialNumber: asset.serialNumber,
        typeId: asset.typeId,
        status: asset.status as any,
        manufacturer: asset.manufacturer,
        model: asset.model,
        vendor: asset.vendor,
        purchaseDate: (asset as any).purchaseDate,
        purchaseCost: (asset as any).purchaseCost,
        warrantyExpiry: (asset as any).warrantyExpiry,
        location: asset.location,
        department: asset.department,
        assignedToId: (asset as any).assignedToId,
        hostname: (asset as any).hostname,
        ipAddress: (asset as any).ipAddress,
        operatingSystem: (asset as any).operatingSystem,
        notes: (asset as any).notes,
        lastInventoryAt: new Date(),
        ciClass: (asset as any).ciClass,
        businessCriticality: (asset as any).businessCriticality,
        riskLevel: (asset as any).riskLevel,
        organizationId: organizationId,
      },
    });
    createdAssets.push(created);
  }
  console.log(`  ✓ Created ${assets.length} sample assets`);

  // Asset relationships
  const dc01 = createdAssets.find(a => a.assetTag === 'SRV-001')!;
  const file01 = createdAssets.find(a => a.assetTag === 'SRV-002')!;
  const web01 = createdAssets.find(a => a.assetTag === 'SRV-003')!;
  const db01 = createdAssets.find(a => a.assetTag === 'SRV-004')!;
  const backup01 = createdAssets.find(a => a.assetTag === 'SRV-005')!;
  const fw01 = createdAssets.find(a => a.assetTag === 'NET-002')!;
  const swCore01 = createdAssets.find(a => a.assetTag === 'NET-001')!;
  const cloudApi = createdAssets.find(a => a.assetTag === 'CLD-001')!;
  const cloudWeb = createdAssets.find(a => a.assetTag === 'CLD-002')!;

  const relationships = [
    { fromAssetId: fw01.id, toAssetId: swCore01.id, type: 'connects_to' as const, description: 'WAN uplink to core switch' },
    { fromAssetId: swCore01.id, toAssetId: dc01.id, type: 'hosts' as const, description: 'Domain controller connected to core' },
    { fromAssetId: swCore01.id, toAssetId: file01.id, type: 'hosts' as const, description: 'File server connected to core' },
    { fromAssetId: swCore01.id, toAssetId: web01.id, type: 'hosts' as const, description: 'Web server connected to core' },
    { fromAssetId: swCore01.id, toAssetId: db01.id, type: 'hosts' as const, description: 'Database server connected to core' },
    { fromAssetId: file01.id, toAssetId: dc01.id, type: 'depends_on' as const, description: 'File server authentication' },
    { fromAssetId: web01.id, toAssetId: db01.id, type: 'depends_on' as const, description: 'Web app database connection' },
    { fromAssetId: backup01.id, toAssetId: dc01.id, type: 'backup_of' as const, description: 'Backup of domain controller' },
    { fromAssetId: cloudApi.id, toAssetId: db01.id, type: 'connects_to' as const, description: 'API connects to on-prem database' },
    { fromAssetId: cloudWeb.id, toAssetId: cloudApi.id, type: 'depends_on' as const, description: 'Web app depends on API' },
  ];

  for (const rel of relationships) {
    try {
      await prisma.assetRelationship.upsert({
        where: {
          fromAssetId_toAssetId_type: {
            fromAssetId: rel.fromAssetId,
            toAssetId: rel.toAssetId,
            type: rel.type,
          },
        },
        update: {},
        create: {
          fromAssetId: rel.fromAssetId,
          toAssetId: rel.toAssetId,
          type: rel.type,
          description: rel.description,
          isActive: true,
        },
      });
    } catch (e) {
      // Skip duplicate relationships
    }
  }
  console.log(`  ✓ Created ${relationships.length} asset relationships`);

  return createdAssets;
}

// ============================================
// SECTION 5: TICKETS & PROBLEMS
// ============================================

async function seedTicketsAndProblems(organizationId: string) {
  console.log('\n🎫 Seeding tickets and problems...');

  const johnUser = await prisma.user.findUnique({ where: { email: 'john.smith@helix.local' } });
  const sarahUser = await prisma.user.findUnique({ where: { email: 'sarah.johnson@helix.local' } });
  const mikeUser = await prisma.user.findUnique({ where: { email: 'mike.wilson@helix.local' } });
  const davidUser = await prisma.user.findUnique({ where: { email: 'david.brown@helix.local' } });
  const lisaUser = await prisma.user.findUnique({ where: { email: 'lisa.anderson@helix.local' } });
  const jamesUser = await prisma.user.findUnique({ where: { email: 'james.taylor@helix.local' } });

  const softwareCategory = await prisma.category.findFirst({ where: { name: 'Software', organizationId: organizationId } });
  const networkCategory = await prisma.category.findFirst({ where: { name: 'Network', organizationId: organizationId } });
  const hardwareCategory = await prisma.category.findFirst({ where: { name: 'Hardware', organizationId: organizationId } });
  const emailCategory = await prisma.category.findFirst({ where: { name: 'Email', organizationId: organizationId } });

  const tickets = [
    { ticketNumber: 'INC-00001', title: 'Users unable to login to application', description: 'Multiple users reporting they cannot login to the CRM application.', status: 'resolved' as const, priority: 'high' as const, categoryId: softwareCategory?.id, requesterId: davidUser?.id, assignedAgentId: sarahUser?.id, resolvedAt: new Date('2024-03-15') },
    { ticketNumber: 'INC-00002', title: 'Network connectivity issues in Building B', description: 'Users in Building B are experiencing intermittent network disconnections.', status: 'resolved' as const, priority: 'critical' as const, categoryId: networkCategory?.id, requesterId: jamesUser?.id, assignedAgentId: mikeUser?.id, resolvedAt: new Date('2024-03-18') },
    { ticketNumber: 'INC-00003', title: 'Email delivery delays', description: 'Emails are taking up to 30 minutes to be delivered internally.', status: 'resolved' as const, priority: 'high' as const, categoryId: emailCategory?.id, requesterId: lisaUser?.id, assignedAgentId: johnUser?.id, resolvedAt: new Date('2024-03-20') },
    { ticketNumber: 'INC-00004', title: 'Database connection timeouts', description: 'Application experiencing slow response times and occasional connection timeouts.', status: 'resolved' as const, priority: 'critical' as const, categoryId: softwareCategory?.id, requesterId: davidUser?.id, assignedAgentId: johnUser?.id, resolvedAt: new Date('2024-03-22') },
    { ticketNumber: 'INC-00005', title: 'Printer not working in Conference Room A', description: 'The printer in Conference Room A shows offline status.', status: 'in_progress' as const, priority: 'low' as const, categoryId: hardwareCategory?.id, requesterId: jamesUser?.id, assignedAgentId: sarahUser?.id },
    { ticketNumber: 'INC-00006', title: 'VPN connection drops frequently', description: 'Users connected via VPN experience random disconnections.', status: 'assigned' as const, priority: 'medium' as const, categoryId: networkCategory?.id, requesterId: jamesUser?.id, assignedAgentId: mikeUser?.id },
    { ticketNumber: 'INC-00007', title: 'Slow file server performance', description: 'File server response time has degraded significantly.', status: 'in_progress' as const, priority: 'medium' as const, categoryId: networkCategory?.id, requesterId: lisaUser?.id, assignedAgentId: mikeUser?.id },
  ];

  const createdTickets = [];
  for (const ticket of tickets) {
    const existing = await prisma.ticket.findFirst({
      where: { ticketNumber: ticket.ticketNumber },
    });

    const createData: any = {
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      description: ticket.description,
      type: 'incident',
      status: ticket.status,
      priority: ticket.priority,
      requesterId: ticket.requesterId,
      resolvedAt: ticket.resolvedAt,
      createdAt: new Date('2024-03-10'),
      updatedAt: new Date(),
      organizationId: organizationId,
    };

    if (ticket.categoryId) createData.categoryId = ticket.categoryId;
    if (ticket.assignedAgentId) createData.assignedAgentId = ticket.assignedAgentId;

    const created = await prisma.ticket.upsert({
      where: { id: existing?.id || '' },
      update: {},
      create: createData,
    });
    createdTickets.push(created);
  }
  console.log(`  ✓ Created ${tickets.length} sample tickets`);

  // Problems
  const problems = [
    { problemNumber: 'PRB-00001', title: 'Authentication Service Intermittently Fails', description: 'Multiple incidents reported where users cannot authenticate.', status: 'investigating' as const, priority: 'high' as const, impact: 'critical' as const, assignedToId: johnUser?.id },
    { problemNumber: 'PRB-00002', title: 'Network Switch Degradation in Building B', description: 'Floor switch causing intermittent network connectivity issues.', status: 'resolved' as const, priority: 'critical' as const, impact: 'high' as const, assignedToId: mikeUser?.id, resolvedAt: new Date('2024-03-25') },
    { problemNumber: 'PRB-00003', title: 'Email Server Performance Degradation', description: 'Email server experiencing performance issues causing delays.', status: 'investigating' as const, priority: 'medium' as const, impact: 'moderate' as const, assignedToId: johnUser?.id },
    { problemNumber: 'PRB-00004', title: 'Database Connection Pool Exhaustion', description: 'Application servers experiencing connection pool exhaustion.', status: 'identified' as const, priority: 'high' as const, impact: 'critical' as const, assignedToId: johnUser?.id },
  ];

  const createdProblems = [];
  for (const problem of problems) {
    const existing = await prisma.problem.findFirst({
      where: { problemNumber: problem.problemNumber },
    });

    const created = await prisma.problem.upsert({
      where: { id: existing?.id || '' },
      update: {},
      create: {
        problemNumber: problem.problemNumber,
        title: problem.title,
        description: problem.description,
        status: problem.status,
        priority: problem.priority,
        impact: problem.impact,
        assignedToId: problem.assignedToId,
        resolvedAt: problem.resolvedAt,
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date(),
        organizationId: organizationId,
      },
    });
    createdProblems.push(created);
  }
  console.log(`  ✓ Created ${problems.length} sample problems`);

  // Link tickets to problems
  const authProblem = createdProblems.find(p => p.problemNumber === 'PRB-00001')!;
  const networkProblem = createdProblems.find(p => p.problemNumber === 'PRB-00002')!;
  const emailProblem = createdProblems.find(p => p.problemNumber === 'PRB-00003')!;
  const dbProblem = createdProblems.find(p => p.problemNumber === 'PRB-00004')!;

  const loginTicket = createdTickets.find(t => t.ticketNumber === 'INC-00001')!;
  const networkTicket = createdTickets.find(t => t.ticketNumber === 'INC-00002')!;
  const emailTicket = createdTickets.find(t => t.ticketNumber === 'INC-00003')!;
  const dbTicket = createdTickets.find(t => t.ticketNumber === 'INC-00004')!;
  const vpnTicket = createdTickets.find(t => t.ticketNumber === 'INC-00006')!;
  const fileTicket = createdTickets.find(t => t.ticketNumber === 'INC-00007')!;

  const problemIncidents = [
    { problemId: authProblem.id, ticketId: loginTicket.id },
    { problemId: networkProblem.id, ticketId: networkTicket.id },
    { problemId: emailProblem.id, ticketId: emailTicket.id },
    { problemId: dbProblem.id, ticketId: dbTicket.id },
    { problemId: networkProblem.id, ticketId: vpnTicket.id },
    { problemId: networkProblem.id, ticketId: fileTicket.id },
  ];

  for (const pi of problemIncidents) {
    try {
      await prisma.problemIncident.upsert({
        where: {
          problemId_ticketId: {
            problemId: pi.problemId,
            ticketId: pi.ticketId,
          },
        },
        update: {},
        create: {
          problemId: pi.problemId,
          ticketId: pi.ticketId,
        },
      });
    } catch (e) {
      // Skip duplicates
    }
  }
  console.log(`  ✓ Linked ${problemIncidents.length} incidents to problems`);

  // Root Cause Analysis
  const rcaRecords = [
    { problemId: authProblem.id, analysisType: 'root_cause' as const, title: 'Domain Controller Authentication Timeout', description: 'Detailed analysis of the authentication timeout issue.', cause: 'High CPU utilization on DC-01 during peak hours.', impact: 'Critical - All users unable to authenticate', solution: 'Optimized LDAP query patterns and added load balancing.', createdById: johnUser?.id },
    { problemId: networkProblem.id, analysisType: 'root_cause' as const, title: 'Faulty Network Switch Hardware', description: 'Root cause analysis of network connectivity issues.', cause: 'Failing network chip causing intermittent packet loss.', impact: 'High - 30+ users affected intermittently', solution: 'Replaced faulty switch with new Cisco Catalyst 2960X.', createdById: mikeUser?.id },
    { problemId: dbProblem.id, analysisType: 'root_cause' as const, title: 'Database Connection Pool Misconfiguration', description: 'Analysis of connection pool exhaustion.', cause: 'Default pool settings insufficient for peak demand.', impact: 'Critical - Multiple services affected', solution: 'Increased pool size to 200 and added monitoring.', createdById: johnUser?.id },
  ];

  for (const rca of rcaRecords) {
    await prisma.rootCauseAnalysis.create({
      data: {
        problemId: rca.problemId,
        analysisType: rca.analysisType,
        title: rca.title,
        description: rca.description,
        cause: rca.cause,
        impact: rca.impact,
        solution: rca.solution,
        createdById: rca.createdById,
      },
    });
  }
  console.log(`  ✓ Created ${rcaRecords.length} root cause analysis records`);

  // Known Errors
  const knownErrors = [
    { problemId: authProblem.id, errorCode: 'AUTH-DC-001', symptoms: 'Users receive "Authentication failed" errors intermittently.', workaround: '1. Clear browser cache\n2. Try incognito window\n3. Wait 5-10 minutes and retry', knownSolution: 'High CPU load on DC-01. Use DC-02 for authentication.', status: 'active' as const },
    { problemId: networkProblem.id, errorCode: 'NET-SW-001', symptoms: 'Network disconnections in Building B.', workaround: '1. Unplug and replug network cable\n2. Move to different port\n3. Use WiFi Guest-Network', knownSolution: 'Hardware issue with floor switch. IT replacing switch.', status: 'resolved' as const },
    { problemId: dbProblem.id, errorCode: 'DB-POOL-001', symptoms: 'Application shows "Service temporarily unavailable".', workaround: '1. Wait 2-3 minutes and refresh\n2. Close and reopen mobile app\n3. Report if persists beyond 5 minutes', knownSolution: 'Database connection pool exhaustion. Restart application server.', status: 'active' as const },
  ];

  for (const ke of knownErrors) {
    try {
      await prisma.knownError.upsert({
        where: { id: ke.problemId },
        update: {},
        create: {
          problemId: ke.problemId,
          errorCode: ke.errorCode,
          symptoms: ke.symptoms,
          workaround: ke.workaround,
          knownSolution: ke.knownSolution,
          status: ke.status,
        },
      });
    } catch (e) {
      // Skip if constraint violation
    }
  }
  console.log(`  ✓ Created ${knownErrors.length} known error records`);

  return { createdTickets, createdProblems };
}

// ============================================
// SECTION 6: CHANGE MANAGEMENT
// ============================================

async function seedChanges(organizationId: string) {
  console.log('\n🔄 Seeding change management...');

  const emily = await prisma.user.findUnique({ where: { email: 'emily.davis@helix.local' } });
  const johnUser = await prisma.user.findUnique({ where: { email: 'john.smith@helix.local' } });
  const mikeUser = await prisma.user.findUnique({ where: { email: 'mike.wilson@helix.local' } });
  const sarahUser = await prisma.user.findUnique({ where: { email: 'sarah.johnson@helix.local' } });
  const davidUser = await prisma.user.findUnique({ where: { email: 'david.brown@helix.local' } });

  const changes = [
    { changeNumber: 'CHG-00001', title: 'Database Server Memory Upgrade', description: 'Upgrade RAM on DB-01 from 64GB to 128GB.', type: 'standard' as const, status: 'approved' as const, priority: 'high' as const, risk: 'medium' as const, category: 'Hardware', justification: 'Memory utilization at 85% during peak hours.', scheduledStartDate: new Date('2024-04-20T22:00:00'), scheduledEndDate: new Date('2024-04-21T02:00:00'), requestedById: davidUser?.id, assignedToId: johnUser?.id, cabReviewed: true, approvedAt: new Date('2024-04-10'), approverId: emily?.id },
    { changeNumber: 'CHG-00002', title: 'Network Switch Replacement - Building B Floor 1', description: 'Replace faulty floor switch SW-FLR-1B.', type: 'normal' as const, status: 'completed' as const, priority: 'critical' as const, risk: 'high' as const, category: 'Network', justification: 'Existing switch causing network issues.', scheduledStartDate: new Date('2024-03-22T18:00:00'), scheduledEndDate: new Date('2024-03-22T22:00:00'), actualStartDate: new Date('2024-03-22T18:15:00'), actualEndDate: new Date('2024-03-22T21:30:00'), requestedById: mikeUser?.id, assignedToId: mikeUser?.id, cabReviewed: true, approvedAt: new Date('2024-03-18'), approverId: emily?.id },
    { changeNumber: 'CHG-00003', title: 'Security Patch - Windows Servers', description: 'Apply latest Windows security patches to production servers.', type: 'standard' as const, status: 'scheduled' as const, priority: 'high' as const, risk: 'low' as const, category: 'Security', justification: 'Monthly security patch cycle.', scheduledStartDate: new Date('2024-04-25T22:00:00'), scheduledEndDate: new Date('2024-04-26T06:00:00'), requestedById: johnUser?.id, assignedToId: sarahUser?.id, cabReviewed: false },
    { changeNumber: 'CHG-00004', title: 'Email Server Migration to New Hardware', description: 'Migrate email server to new VM with improved specs.', type: 'normal' as const, status: 'pending_approval' as const, priority: 'medium' as const, risk: 'high' as const, category: 'Software', justification: 'Current email server is 5 years old.', scheduledStartDate: new Date('2024-05-01T20:00:00'), scheduledEndDate: new Date('2024-05-03T20:00:00'), requestedById: johnUser?.id, assignedToId: johnUser?.id, cabReviewed: true },
    { changeNumber: 'CHG-00005', title: 'Emergency Firewall Rule Addition', description: 'Add emergency firewall rule for vendor VPN access.', type: 'emergency' as const, status: 'approved' as const, priority: 'critical' as const, risk: 'medium' as const, category: 'Security', justification: 'New vendor requires immediate VPN access.', scheduledStartDate: new Date('2024-04-15T14:00:00'), scheduledEndDate: new Date('2024-04-15T15:00:00'), requestedById: sarahUser?.id, assignedToId: mikeUser?.id, cabReviewed: false, approvedAt: new Date('2024-04-15'), approverId: johnUser?.id },
    { changeNumber: 'CHG-00006', title: 'Load Balancer Configuration Update', description: 'Add new backend server to load balancer pool.', type: 'standard' as const, status: 'in_progress' as const, priority: 'medium' as const, risk: 'medium' as const, category: 'Network', justification: 'Adding new web server to handle increased traffic.', scheduledStartDate: new Date('2024-04-18T20:00:00'), scheduledEndDate: new Date('2024-04-18T23:00:00'), actualStartDate: new Date('2024-04-18T20:30:00'), requestedById: johnUser?.id, assignedToId: mikeUser?.id, cabReviewed: true, approvedAt: new Date('2024-04-17'), approverId: emily?.id },
    { changeNumber: 'CHG-00007', title: 'VPN Server License Expansion', description: 'Increase VPN session limit from 100 to 200.', type: 'standard' as const, status: 'draft' as const, priority: 'medium' as const, risk: 'low' as const, category: 'Network', justification: 'VPN usage increased 40% since pandemic.', requestedById: davidUser?.id, assignedToId: mikeUser?.id, cabReviewed: false },
  ];

  const createdChanges = [];
  for (const change of changes) {
    const existing = await prisma.changeRequest.findFirst({
      where: { changeNumber: change.changeNumber },
    });

    const created = await prisma.changeRequest.upsert({
      where: { id: existing?.id || '' },
      update: {},
      create: {
        changeNumber: change.changeNumber,
        title: change.title,
        description: change.description,
        type: change.type,
        status: change.status,
        priority: change.priority,
        risk: change.risk,
        // Note: changeCategoryId is not set because ChangeCategory records don't exist
        // The change.category field is informational only
        justification: change.justification,
        scheduledStartDate: change.scheduledStartDate,
        scheduledEndDate: change.scheduledEndDate,
        actualStartDate: change.actualStartDate,
        actualEndDate: (change as any).actualEndDate,
        requestedById: change.requestedById,
        assignedToId: change.assignedToId,
        cabReviewed: change.cabReviewed,
        approvedAt: change.approvedAt,
        approvedById: change.approverId,
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date(),
        organizationId: organizationId,
      },
    });
    createdChanges.push(created);
  }
  console.log(`  ✓ Created ${changes.length} sample change requests`);

  return createdChanges;
}

// ============================================
// SECTION 7: SLA & OLA POLICIES
// ============================================

async function seedSlaOla(organizationId: string) {
  console.log('\n📋 Seeding SLA and OLA policies...');

  const slaPolicies = [
    { name: 'Standard - Critical Priority', description: 'Default SLA for critical priority tickets', priority: 'critical' as const, responseTimeHours: 1, resolutionTimeHours: 4, warningThreshold: 75 },
    { name: 'Standard - High Priority', description: 'Default SLA for high priority tickets', priority: 'high' as const, responseTimeHours: 2, resolutionTimeHours: 8, warningThreshold: 75 },
    { name: 'Standard - Medium Priority', description: 'Default SLA for medium priority tickets', priority: 'medium' as const, responseTimeHours: 4, resolutionTimeHours: 24, warningThreshold: 75 },
    { name: 'Standard - Low Priority', description: 'Default SLA for low priority tickets', priority: 'low' as const, responseTimeHours: 8, resolutionTimeHours: 72, warningThreshold: 75 },
    { name: 'Premium - Critical Priority', description: 'Enhanced SLA for premium users with critical tickets', priority: 'critical' as const, userTier: 'premium' as const, responseTimeHours: 0.5, resolutionTimeHours: 2, warningThreshold: 80 },
    { name: 'Premium - High Priority', description: 'Enhanced SLA for premium users with high priority tickets', priority: 'high' as const, userTier: 'premium' as const, responseTimeHours: 1, resolutionTimeHours: 4, warningThreshold: 80 },
    { name: 'Enterprise - Critical Priority', description: 'Premium SLA for enterprise customers', priority: 'critical' as const, userTier: 'enterprise' as const, responseTimeHours: 0.25, resolutionTimeHours: 1, warningThreshold: 90 },
    { name: 'Enterprise - High Priority', description: 'Premium SLA for enterprise customers', priority: 'high' as const, userTier: 'enterprise' as const, responseTimeHours: 0.5, resolutionTimeHours: 2, warningThreshold: 90 },
  ];

  for (const policy of slaPolicies) {
    try {
      const existingPolicy = await prisma.slaPolicy.findFirst({
        where: { name: policy.name, organizationId: organizationId },
      });
      if (!existingPolicy) {
        await prisma.slaPolicy.create({
          data: {
            name: policy.name,
            description: policy.description,
            priority: policy.priority,
            userTier: (policy as any).userTier,
            responseTimeHours: policy.responseTimeHours,
            resolutionTimeHours: policy.resolutionTimeHours,
            warningThreshold: policy.warningThreshold,
            isActive: true,
            organizationId: organizationId,
          },
        });
      }
    } catch (e) {
      // Skip if constraint violation
    }
  }
  console.log(`  ✓ Created ${slaPolicies.length} SLA policies`);

  const olaPolicies = [
    { name: 'First Line → Second Line Handoff', description: 'OLA for tickets escalated from First Line to Second Line support', fromTeamType: 'first_line' as const, toTeamType: 'second_line' as const, responseTimeHours: 2, resolutionTimeHours: 8 },
    { name: 'First Line → Third Line Handoff', description: 'OLA for tickets escalated from First Line to Third Line', fromTeamType: 'first_line' as const, toTeamType: 'third_line' as const, responseTimeHours: 4, resolutionTimeHours: 24 },
    { name: 'Second Line → Third Line Handoff', description: 'OLA for tickets escalated from Second Line to Third Line', fromTeamType: 'second_line' as const, toTeamType: 'third_line' as const, responseTimeHours: 8, resolutionTimeHours: 48 },
  ];

  for (const policy of olaPolicies) {
    try {
      const existingPolicy = await prisma.olaPolicy.findFirst({
        where: { name: policy.name, organizationId: organizationId },
      });
      if (!existingPolicy) {
        await prisma.olaPolicy.create({
          data: {
            name: policy.name,
            description: policy.description,
            fromTeamType: policy.fromTeamType,
            toTeamType: policy.toTeamType,
            responseTimeHours: policy.responseTimeHours,
            resolutionTimeHours: policy.resolutionTimeHours,
            isActive: true,
            organizationId: organizationId,
          },
        });
      }
    } catch (e) {
      // Skip if constraint violation
    }
  }
  console.log(`  ✓ Created ${olaPolicies.length} OLA policies`);

  // Update user tiers
  const vipUser = await prisma.user.findUnique({ where: { email: 'emily.davis@helix.local' } });
  const enterpriseUser = await prisma.user.findUnique({ where: { email: 'lisa.anderson@helix.local' } });
  const premiumUser = await prisma.user.findUnique({ where: { email: 'jennifer.martinez@helix.local' } });

  if (vipUser) {
    await prisma.user.update({ where: { id: vipUser.id }, data: { tier: 'vip' } });
    console.log(`  ✓ Set VIP tier for ${vipUser.email}`);
  }
  if (enterpriseUser) {
    await prisma.user.update({ where: { id: enterpriseUser.id }, data: { tier: 'enterprise' } });
    console.log(`  ✓ Set Enterprise tier for ${enterpriseUser.email}`);
  }
  if (premiumUser) {
    await prisma.user.update({ where: { id: premiumUser.id }, data: { tier: 'premium' } });
    console.log(`  ✓ Set Premium tier for ${premiumUser.email}`);
  }
}

// ============================================
// SECTION 8: SOFTWARE CATALOG & LICENSES
// ============================================

async function seedSoftware(organizationId: string) {
  console.log('\n📦 Seeding software catalog and licenses...');

  const softwareCatalog = [
    { name: 'Microsoft 365 Business Premium', slug: 'microsoft-365-business-premium', version: 'Latest', vendor: 'Microsoft', publisher: 'Microsoft Corporation', description: 'Complete productivity suite.', category: 'productivity' as const, licenseType: 'subscription' as const },
    { name: 'Adobe Creative Cloud', slug: 'adobe-creative-cloud', version: '2024', vendor: 'Adobe', publisher: 'Adobe Inc.', description: 'Design and creativity software.', category: 'graphics' as const, licenseType: 'subscription' as const },
    { name: 'Visual Studio Enterprise', slug: 'visual-studio-enterprise', version: '2022', vendor: 'Microsoft', publisher: 'Microsoft Corporation', description: 'Professional IDE for software development.', category: 'development' as const, licenseType: 'subscription' as const },
    { name: 'Slack Business+', slug: 'slack-business-plus', version: 'Latest', vendor: 'Salesforce', publisher: 'Salesforce', description: 'Team communication platform.', category: 'communication' as const, licenseType: 'subscription' as const },
    { name: 'Zoom Business', slug: 'zoom-business', version: 'Latest', vendor: 'Zoom Video Communications', publisher: 'Zoom', description: 'Video conferencing platform.', category: 'communication' as const, licenseType: 'subscription' as const },
    { name: 'Jira Software', slug: 'jira-software', version: 'Latest', vendor: 'Atlassian', publisher: 'Atlassian', description: 'Project management and issue tracking.', category: 'development' as const, licenseType: 'subscription' as const },
    { name: 'Windows 11 Pro', slug: 'windows-11-pro', version: '11 Pro', vendor: 'Microsoft', publisher: 'Microsoft Corporation', description: 'Operating system for business.', category: 'operating_system' as const, licenseType: 'perpetual' as const },
    { name: 'WinZip Enterprise', slug: 'winzip-enterprise', version: '28.0', vendor: 'WinZip Computing', publisher: 'WinZip', description: 'File compression utility.', category: 'utility' as const, licenseType: 'perpetual' as const },
  ];

  const createdSoftware = [];
  for (const sw of softwareCatalog) {
    // Check if software already exists
    const existingSoftware = await prisma.software.findFirst({
      where: { slug: sw.slug, organizationId: organizationId },
    });
    let software;
    if (existingSoftware) {
      software = existingSoftware;
    } else {
      software = await prisma.software.create({
        data: {
          name: sw.name,
          slug: sw.slug,
          version: sw.version,
          vendor: sw.vendor,
          publisher: sw.publisher,
          description: sw.description,
          category: sw.category,
          licenseType: sw.licenseType,
          isActive: true,
          organizationId: organizationId,
        },
      });
    }
    createdSoftware.push(software);
  }
  console.log(`  ✓ Created ${softwareCatalog.length} software applications`);

  const m365 = createdSoftware.find(s => s.slug === 'microsoft-365-business-premium')!;
  const adobe = createdSoftware.find(s => s.slug === 'adobe-creative-cloud')!;
  const vs = createdSoftware.find(s => s.slug === 'visual-studio-enterprise')!;
  const slack = createdSoftware.find(s => s.slug === 'slack-business-plus')!;
  const jira = createdSoftware.find(s => s.slug === 'jira-software')!;
  const winzip = createdSoftware.find(s => s.slug === 'winzip-enterprise')!;

  const licenses = [
    { softwareId: m365.id, name: 'Microsoft 365 E3 - Annual', licenseKey: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', licenseType: 'subscription' as const, totalSeats: 50, purchasedSeats: 50, cost: 192000, purchaseDate: new Date('2024-01-01'), expiryDate: new Date('2025-01-01'), subscriptionId: 'SUB-M365-E3-2024' },
    { softwareId: m365.id, name: 'Microsoft 365 E3 - Additional Seats', licenseKey: 'YYYYY-YYYYY-YYYYY-YYYYY-YYYYY', licenseType: 'subscription' as const, totalSeats: 25, purchasedSeats: 18, cost: 96000, purchaseDate: new Date('2024-03-15'), expiryDate: new Date('2025-03-15'), subscriptionId: 'SUB-M365-E3-ADD' },
    { softwareId: adobe.id, name: 'Adobe CC Team - All Apps', licenseKey: 'ADOBE-CC-TEAM-2024', licenseType: 'subscription' as const, totalSeats: 10, purchasedSeats: 8, cost: 45000, purchaseDate: new Date('2024-01-15'), expiryDate: new Date('2025-01-15'), subscriptionId: 'Adobe-CC-TEAM-2024' },
    { softwareId: vs.id, name: 'Visual Studio Enterprise - Dev Team', licenseKey: 'VS-ENTERPRISE-2022-DEVS', licenseType: 'subscription' as const, totalSeats: 15, purchasedSeats: 12, cost: 45000, purchaseDate: new Date('2024-02-01'), expiryDate: new Date('2025-02-01'), subscriptionId: 'VS-ENT-DEV-2024' },
    { softwareId: slack.id, name: 'Slack Business+ - Full Company', licenseKey: 'SLACK-BIZ-PLUS-2024', licenseType: 'subscription' as const, totalSeats: 100, purchasedSeats: 85, cost: 120000, purchaseDate: new Date('2024-01-01'), expiryDate: new Date('2025-01-01'), subscriptionId: 'Slack-BP-2024' },
    { softwareId: jira.id, name: 'Jira Software Standard - IT Team', licenseKey: 'JIRA-STD-IT-2024', licenseType: 'subscription' as const, totalSeats: 25, purchasedSeats: 22, cost: 17500, purchaseDate: new Date('2024-03-01'), expiryDate: new Date('2025-03-01'), subscriptionId: 'Jira-STD-IT-2024' },
    { softwareId: winzip.id, name: 'WinZip Enterprise - Maintenance', licenseKey: 'WINZIP-ENT-MAINT-2023', licenseType: 'subscription' as const, totalSeats: 75, purchasedSeats: 65, cost: 7500, purchaseDate: new Date('2023-04-01'), expiryDate: new Date('2024-05-01'), subscriptionId: 'WinZip-Maint-2023' },
  ];

  const admin = await prisma.user.findUnique({ where: { email: 'admin@helix.local' } });

  for (const lic of licenses) {
    await prisma.softwareLicense.create({
      data: {
        softwareId: lic.softwareId,
        name: lic.name,
        licenseKey: lic.licenseKey,
        licenseType: lic.licenseType,
        totalSeats: lic.totalSeats,
        purchasedSeats: lic.purchasedSeats,
        cost: lic.cost,
        purchaseDate: lic.purchaseDate,
        expiryDate: lic.expiryDate,
        subscriptionId: lic.subscriptionId,
        isActive: true,
        organizationId: organizationId,
      },
    });
  }
  console.log(`  ✓ Created ${licenses.length} software licenses`);
}

// ============================================
// SECTION 9: ADDITIONAL SAMPLE TICKETS
// ============================================

async function seedMoreTickets(organizationId: string) {
  console.log('\n🎫 Seeding additional sample tickets...');

  const users = await prisma.user.findMany({ where: { isActive: true } });
  // All users have role 'user' since UserRole enum only has 'user' and 'superadmin'
  // We use department and jobTitle to infer user type for ticket assignment
  const agents = users.filter(u => u.department === 'IT' && u.jobTitle?.includes('Agent'));
  const requesters = users.filter(u => u.department !== 'IT' || !u.jobTitle?.includes('Agent'));
  const categories = await prisma.category.findMany({ where: { parentId: null, isActive: true, organizationId: organizationId } });

  const softwareCategory = categories.find(c => c.name === 'Software');
  const networkCategory = categories.find(c => c.name === 'Network');
  const hardwareCategory = categories.find(c => c.name === 'Hardware');
  const emailCategory = categories.find(c => c.name === 'Email');
  const accessCategory = categories.find(c => c.name === 'Access');
  const securityCategory = categories.find(c => c.name === 'Security');

  const statuses = ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'] as const;
  const priorities = ['low', 'medium', 'high', 'critical'] as const;

  const ticketTemplates = [
    // Software issues
    { title: 'Outlook crashes when opening attachments', category: softwareCategory, priority: 'medium' },
    { title: 'Excel formulas not calculating correctly', category: softwareCategory, priority: 'low' },
    { title: 'Adobe Acrobat reader not installing', category: softwareCategory, priority: 'medium' },
    { title: 'Zoom audio not working in meetings', category: softwareCategory, priority: 'high' },
    { title: 'Visual Studio debugging session hangs', category: softwareCategory, priority: 'high' },
    { title: 'Slack notifications not appearing', category: softwareCategory, priority: 'low' },
    { title: 'Jira dashboard not loading', category: softwareCategory, priority: 'medium' },
    { title: 'Chrome browser keeps freezing', category: softwareCategory, priority: 'medium' },
    { title: 'Teams screen share not working', category: softwareCategory, priority: 'high' },
    { title: 'Word documents corrupted after save', category: softwareCategory, priority: 'critical' },
    // Network issues
    { title: 'WiFi signal weak in Building C', category: networkCategory, priority: 'medium' },
    { title: 'VPN connection timeout issues', category: networkCategory, priority: 'high' },
    { title: 'Cannot access shared network drive', category: networkCategory, priority: 'high' },
    { title: 'Slow internet connection in conference rooms', category: networkCategory, priority: 'low' },
    { title: 'Network printer not discovered', category: networkCategory, priority: 'medium' },
    { title: 'Intermittent network drops on Floor 3', category: networkCategory, priority: 'high' },
    { title: 'Remote desktop connection fails', category: networkCategory, priority: 'medium' },
    { title: 'Cannot connect to company VPN', category: networkCategory, priority: 'critical' },
    { title: 'Bandwidth throttling affecting video calls', category: networkCategory, priority: 'medium' },
    { title: 'DNS resolution failing for internal sites', category: networkCategory, priority: 'critical' },
    // Hardware issues
    { title: 'Laptop screen flickering', category: hardwareCategory, priority: 'medium' },
    { title: 'Keyboard keys sticking', category: hardwareCategory, priority: 'low' },
    { title: 'USB ports not recognizing devices', category: hardwareCategory, priority: 'medium' },
    { title: 'Mouse cursor jumping randomly', category: hardwareCategory, priority: 'low' },
    { title: 'Monitor showing blue tint', category: hardwareCategory, priority: 'medium' },
    { title: 'Webcam not detected in Teams', category: hardwareCategory, priority: 'medium' },
    { title: 'Battery not charging on laptop', category: hardwareCategory, priority: 'high' },
    { title: 'Audio jack producing static noise', category: hardwareCategory, priority: 'low' },
    { title: 'External monitor not detected', category: hardwareCategory, priority: 'medium' },
    { title: 'Docking station USB ports failed', category: hardwareCategory, priority: 'medium' },
    // Email issues
    { title: 'Emails bouncing back to sender', category: emailCategory, priority: 'high' },
    { title: 'Cannot delete emails from inbox', category: emailCategory, priority: 'low' },
    { title: 'Email signature not updating', category: emailCategory, priority: 'low' },
    { title: 'Auto-reply not working', category: emailCategory, priority: 'medium' },
    { title: 'Emails going to spam folder', category: emailCategory, priority: 'medium' },
    { title: 'Distribution list not receiving emails', category: emailCategory, priority: 'high' },
    { title: 'Calendar invites not syncing', category: emailCategory, priority: 'medium' },
    { title: 'Email attachment size limit exceeded', category: emailCategory, priority: 'medium' },
    { title: 'Shared mailbox not accessible', category: emailCategory, priority: 'high' },
    { title: 'Email rules not executing', category: emailCategory, priority: 'low' },
    // Access issues
    { title: 'Need access to SharePoint site', category: accessCategory, priority: 'medium' },
    { title: 'Password reset required', category: accessCategory, priority: 'high' },
    { title: '2FA token not syncing', category: accessCategory, priority: 'high' },
    { title: 'Need admin rights for software install', category: accessCategory, priority: 'medium' },
    { title: 'Cannot access archived files', category: accessCategory, priority: 'low' },
    { title: 'SSO login failing for third-party app', category: accessCategory, priority: 'high' },
    { title: 'Need elevated database permissions', category: accessCategory, priority: 'medium' },
    { title: 'Account locked after multiple attempts', category: accessCategory, priority: 'critical' },
    { title: 'Cannot access company portal', category: accessCategory, priority: 'medium' },
    { title: 'Need access to legacy system', category: accessCategory, priority: 'low' },
    // Security issues
    { title: 'Received suspicious phishing email', category: securityCategory, priority: 'critical' },
    { title: 'Unusual login from unknown location', category: securityCategory, priority: 'critical' },
    { title: 'Malware warning on computer', category: securityCategory, priority: 'critical' },
    { title: 'Unauthorized access attempt detected', category: securityCategory, priority: 'critical' },
    { title: 'Sensitive file shared publicly by mistake', category: securityCategory, priority: 'critical' },
    { title: 'Lost company mobile device', category: securityCategory, priority: 'high' },
    { title: 'Password policy compliance issue', category: securityCategory, priority: 'medium' },
    { title: 'Security certificate expired warning', category: securityCategory, priority: 'high' },
    { title: 'Unauthorized software installed', category: securityCategory, priority: 'high' },
    { title: 'Firewall blocked legitimate application', category: securityCategory, priority: 'medium' },
  ];

  let count = 0;
  let ticketNumber = 8; // Start after existing tickets

  for (const template of ticketTemplates) {
    if (!template.category) continue;

    const requester = requesters[Math.floor(Math.random() * requesters.length)];
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const daysAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    const ticketNumberStr = `INC-${String(ticketNumber).padStart(5, '0')}`;

    const existing = await prisma.ticket.findFirst({
      where: { ticketNumber: ticketNumberStr },
    });

    if (!existing) {
      await prisma.ticket.create({
        data: {
          ticketNumber: ticketNumberStr,
          title: template.title,
          description: `${template.title}. This issue requires immediate attention from the IT support team.`,
          type: 'incident',
          status,
          priority: template.priority as any,
          categoryId: template.category.id,
          requesterId: requester?.id,
          assignedAgentId: ['assigned', 'in_progress', 'pending', 'resolved', 'closed'].includes(status) ? agent?.id : undefined,
          createdAt,
          updatedAt: createdAt,
          resolvedAt: ['resolved', 'closed'].includes(status) ? new Date() : undefined,
          closedAt: status === 'closed' ? new Date() : undefined,
          organizationId: organizationId,
        },
      });
      count++;
    }

    ticketNumber++;
  }

  console.log(`  ✓ Added ${count} additional sample tickets`);
}

// ============================================
// SECTION 10: MULTI-ORGANIZATION SEED (Optional)
// ============================================

async function seedOrganizations() {
  console.log('\n🏢 Seeding multi-organization data...');

  const hashedPassword = await bcrypt.hash('Admin123!', 12);

  // Organization 1: Acme Corporation
  const acmeOrg = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      status: 'active',
      maxUsers: 100,
      primaryColor: '#0066CC',
    },
  });
  console.log(`  ✓ Created organization: ${acmeOrg.name}`);

  // Organization 2: TechStart Inc
  const techstartOrg = await prisma.organization.upsert({
    where: { slug: 'techstart' },
    update: {},
    create: {
      name: 'TechStart Inc',
      slug: 'techstart',
      status: 'active',
      maxUsers: 50,
      primaryColor: '#8B5CF6',
    },
  });
  console.log(`  ✓ Created organization: ${techstartOrg.name}`);

  // Organization 3: Global Solutions Ltd
  const globalOrg = await prisma.organization.upsert({
    where: { slug: 'global-solutions' },
    update: {},
    create: {
      name: 'Global Solutions Ltd',
      slug: 'global-solutions',
      status: 'active',
      maxUsers: 25,
      primaryColor: '#22C55E',
    },
  });
  console.log(`  ✓ Created organization: ${globalOrg.name}`);

  // Create users for each organization
  const orgUsers = [
    // Acme Corp
    { email: 'acme.john@helix.local', firstName: 'John', lastName: 'Adams', role: 'user' as const, orgSlug: 'acme-corp', orgRole: 'manager' },
    { email: 'acme.sarah@helix.local', firstName: 'Sarah', lastName: 'Miller', role: 'user' as const, orgSlug: 'acme-corp', orgRole: 'agent' },
    { email: 'acme.mike@helix.local', firstName: 'Mike', lastName: 'Chen', role: 'user' as const, orgSlug: 'acme-corp', orgRole: 'agent' },
    { email: 'acme.requester1@helix.local', firstName: 'Alice', lastName: 'Johnson', role: 'user' as const, orgSlug: 'acme-corp', orgRole: 'requester' },
    // TechStart
    { email: 'techstart.admin@helix.local', firstName: 'Admin', lastName: 'Tech', role: 'user' as const, orgSlug: 'techstart', orgRole: 'orgadmin' },
    { email: 'techstart.agent1@helix.local', firstName: 'Tom', lastName: 'Wilson', role: 'user' as const, orgSlug: 'techstart', orgRole: 'agent' },
    { email: 'techstart.user1@helix.local', firstName: 'Lucas', lastName: 'Smith', role: 'user' as const, orgSlug: 'techstart', orgRole: 'requester' },
    // Global Solutions
    { email: 'global.admin@helix.local', firstName: 'Global', lastName: 'Admin', role: 'user' as const, orgSlug: 'global-solutions', orgRole: 'orgadmin' },
    { email: 'global.agent@helix.local', firstName: 'Rachel', lastName: 'Green', role: 'user' as const, orgSlug: 'global-solutions', orgRole: 'agent' },
    { email: 'global.user@helix.local', firstName: 'Chris', lastName: 'Taylor', role: 'user' as const, orgSlug: 'global-solutions', orgRole: 'requester' },
  ];

  const orgMapping: Record<string, any> = {
    'acme-corp': acmeOrg,
    'techstart': techstartOrg,
    'global-solutions': globalOrg,
  };

  for (const userData of orgUsers) {
    const org = orgMapping[userData.orgSlug];
    if (!org) continue;

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role as any,
        authProvider: 'local',
        isActive: true,
      },
    });

    await prisma.organizationUser.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
      update: { orgRole: userData.orgRole as any },
      create: {
        organizationId: org.id,
        userId: user.id,
        orgRole: userData.orgRole as any,
      },
    });
  }
  console.log(`  ✓ Created ${orgUsers.length} organization users`);

  // Create teams for each organization
  const orgTeams = [
    { name: 'Acme IT Support', type: 'first_line' as const, orgSlug: 'acme-corp' },
    { name: 'TechStart Support', type: 'first_line' as const, orgSlug: 'techstart' },
    { name: 'Global Help Desk', type: 'first_line' as const, orgSlug: 'global-solutions' },
  ];

  for (const teamData of orgTeams) {
    const org = orgMapping[teamData.orgSlug];
    if (!org) continue;

    await prisma.team.upsert({
      where: { name_organizationId: { name: teamData.name, organizationId: org.id } },
      update: {},
      create: {
        name: teamData.name,
        type: teamData.type,
        description: `${teamData.name} team`,
        isActive: true,
        organizationId: org.id,
      },
    });
  }
  console.log(`  ✓ Created ${orgTeams.length} organization teams`);

  // Create ticket categories for each organization
  const orgCategories = [
    { name: 'Acme Hardware', orgSlug: 'acme-corp', sortOrder: 1 },
    { name: 'TS Dev Tools', orgSlug: 'techstart', sortOrder: 1 },
    { name: 'Global Office', orgSlug: 'global-solutions', sortOrder: 1 },
  ];

  for (const cat of orgCategories) {
    const org = orgMapping[cat.orgSlug];
    if (!org) continue;

    await prisma.category.upsert({
      where: { id: `${cat.orgSlug}-${cat.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `${cat.orgSlug}-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: cat.name,
        description: cat.name,
        sortOrder: cat.sortOrder,
        isActive: true,
        organizationId: org.id,
      },
    });
  }
  console.log(`  ✓ Created ${orgCategories.length} organization categories`);
}

// ============================================
// SECTION 11: DATA FIXES (Optional)
// ============================================

async function fixEmailComments() {
  console.log('\n🔧 Running data fixes...');

  const result = await prisma.comment.updateMany({
    where: {
      ticket: {
        channel: 'email',
      },
      OR: [
        { channel: null },
        { channel: undefined },
        { channel: 'web' },
      ],
    },
    data: {
      channel: 'email',
    },
  });

  console.log(`  ✓ Updated ${result.count} email comments`);

  const commentsWithoutRecipients = await prisma.comment.findMany({
    where: {
      channel: 'email',
      OR: [
        { replyToAddresses: null },
        { replyToAddresses: '' },
      ],
      ticket: {
        channel: 'email',
      },
    },
    include: {
      ticket: {
        include: {
          requester: true,
        },
      },
    },
  });

  for (const comment of commentsWithoutRecipients) {
    if (comment.ticket.requester?.email) {
      await prisma.comment.update({
        where: { id: comment.id },
        data: {
          replyToAddresses: comment.ticket.requester.email,
        },
      });
    }
  }

  console.log(`  ✓ Fixed ${commentsWithoutRecipients.length} comment reply addresses`);
}

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  console.log('============================================');
  console.log('  Helix Helpdesk Database Seeder');
  console.log('============================================');

  try {
    // Step 1: Create Default Organization
    const defaultOrg = await seedDefaultOrganization();

    // Step 2: Core seed data (all attached to Default Organization)
    const baseData = await seedBaseData(defaultOrg.id);
    await seedKnowledgeBase(defaultOrg.id);
    await seedServices(defaultOrg.id);
    await seedAssets(defaultOrg.id);
    await seedTicketsAndProblems(defaultOrg.id);
    await seedChanges(defaultOrg.id);
    await seedSlaOla(defaultOrg.id);
    await seedSoftware(defaultOrg.id);
    await seedMoreTickets(defaultOrg.id);

    // Optional: Multi-organization seed
    if (includeOrgs) {
      await seedOrganizations();
    }

    // Optional: Data fixes
    if (includeFixes) {
      await fixEmailComments();
    }

    console.log('\n============================================');
    console.log('  Database seeding completed!');
    console.log('============================================');
    console.log('\nTest Accounts (password: Admin123!):');
    console.log('  Admin:     admin@helix.local');
    console.log('  Manager:   john.smith@helix.local');
    console.log('  Agent:     sarah.johnson@helix.local');
    console.log('  User:      david.brown@helix.local');
    console.log('\nSample Assets:');
    console.log('  SRV-001 to SRV-005 (Servers)');
    console.log('  NET-001 to NET-003 (Network)');
    console.log('  LAP-001 to LAP-004 (Laptops)');
    console.log('  CLD-001, CLD-002 (Cloud)');
    console.log('\nSample Software Licenses:');
    console.log('  Microsoft 365 E3 (50 seats)');
    console.log('  Adobe CC Team (10 seats)');
    console.log('  Visual Studio Enterprise (15 seats)');
    if (includeOrgs) {
      console.log('\nOrganizations:');
      console.log('  Acme Corporation (acme-corp) - Enterprise');
      console.log('  TechStart Inc (techstart) - Premium');
      console.log('  Global Solutions Ltd (global-solutions) - Standard');
    }
  } catch (e) {
    console.error('Error during seeding:', e);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
