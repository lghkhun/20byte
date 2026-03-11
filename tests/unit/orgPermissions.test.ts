import test from "node:test";
import assert from "node:assert/strict";

import { Role } from "@prisma/client";

import {
  canAccessInbox,
  canAccessOrganizationSettings,
  canAssignOrganizationRole,
  canManageOrganizationMember,
  canViewOrganizationMembers
} from "@/lib/permissions/orgPermissions";

test("owner and admin can view organization members", () => {
  assert.equal(canViewOrganizationMembers(Role.OWNER), true);
  assert.equal(canViewOrganizationMembers(Role.ADMIN), true);
  assert.equal(canViewOrganizationMembers(Role.CS), false);
  assert.equal(canViewOrganizationMembers(Role.ADVERTISER), false);
});

test("role assignment matrix follows policy", () => {
  assert.equal(canAssignOrganizationRole(Role.OWNER, Role.ADMIN), true);
  assert.equal(canAssignOrganizationRole(Role.OWNER, Role.CS), true);
  assert.equal(canAssignOrganizationRole(Role.OWNER, Role.ADVERTISER), true);
  assert.equal(canAssignOrganizationRole(Role.OWNER, Role.OWNER), false);

  assert.equal(canAssignOrganizationRole(Role.ADMIN, Role.CS), true);
  assert.equal(canAssignOrganizationRole(Role.ADMIN, Role.ADVERTISER), true);
  assert.equal(canAssignOrganizationRole(Role.ADMIN, Role.ADMIN), false);
  assert.equal(canAssignOrganizationRole(Role.ADMIN, Role.OWNER), false);
});

test("member management matrix follows policy", () => {
  assert.equal(canManageOrganizationMember(Role.OWNER, Role.OWNER), true);
  assert.equal(canManageOrganizationMember(Role.OWNER, Role.ADMIN), true);
  assert.equal(canManageOrganizationMember(Role.ADMIN, Role.CS), true);
  assert.equal(canManageOrganizationMember(Role.ADMIN, Role.ADVERTISER), true);
  assert.equal(canManageOrganizationMember(Role.ADMIN, Role.OWNER), false);
});

test("settings and inbox access matrix follows policy", () => {
  assert.equal(canAccessOrganizationSettings(Role.OWNER), true);
  assert.equal(canAccessOrganizationSettings(Role.ADMIN), true);
  assert.equal(canAccessOrganizationSettings(Role.CS), false);

  assert.equal(canAccessInbox(Role.OWNER), true);
  assert.equal(canAccessInbox(Role.ADMIN), true);
  assert.equal(canAccessInbox(Role.CS), true);
  assert.equal(canAccessInbox(Role.ADVERTISER), false);
});
