import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { getVereinAccess, Permission } from "./rbac";

const LIST_CREATOR_PERMISSIONS: Permission[] = ["settings.edit", "rolle.manage"];
const TASK_LIST_VIEW_ALL_PERMISSION: Permission = "aufgaben.viewAll";
const TODAY_UPCOMING_WINDOW_DAYS = 14;

const taskListRoleValidator = v.union(v.literal("admin"), v.literal("bearbeiter"), v.literal("mitarbeiter"));
const taskStatusValidator = v.union(v.literal("offen"), v.literal("in_bearbeitung"), v.literal("blockiert"), v.literal("erledigt"));
const taskListMemberValidator = v.object({
    mitgliedId: v.id("mitglied"),
    rolle: taskListRoleValidator,
});

type ReadCtx = QueryCtx | MutationCtx;
type TaskListRole = "admin" | "bearbeiter" | "mitarbeiter";
type TaskStatus = "offen" | "in_bearbeitung" | "blockiert" | "erledigt";
type TaskListMembership = Doc<"aufgaben_liste_mitglied">;
type ModuleContext = {
    access: Awaited<ReturnType<typeof getVereinAccess>>;
    myMitgliedIds: Id<"mitglied">[];
    myMitgliedIdSet: Set<Id<"mitglied">>;
    canCreateLists: boolean;
};

type TaskListAccess = ModuleContext & {
    liste: Doc<"aufgaben_liste">;
    memberships: TaskListMembership[];
    role: TaskListRole;
    canManageMembers: boolean;
    canEditAllTasks: boolean;
    canCreateTasks: boolean;
    canDeleteTasks: boolean;
    canDeleteList: boolean;
};

function getOwnMitgliedId(moduleContext: ModuleContext) {
    const ownMitgliedId = moduleContext.myMitgliedIds[0];
    if (!ownMitgliedId) {
        throw new Error("Du musst als Mitglied im Verein hinterlegt sein, um eine Aufgabenliste anzulegen");
    }

    return ownMitgliedId;
}

function nowIso() {
    return new Date().toISOString();
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
    const date = new Date(`${dateKey}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function trimAndNormalize(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value?: string) {
    const normalized = trimAndNormalize(value ?? "");
    return normalized || undefined;
}

function normalizeDate(value?: string) {
    const normalized = value?.trim();
    return normalized || undefined;
}

function lower(value: string) {
    return trimAndNormalize(value).toLowerCase();
}

function uniqueIds<T extends string>(values: readonly T[]) {
    return Array.from(new Set(values));
}

function roleRank(role: TaskListRole) {
    switch (role) {
        case "admin":
            return 3;
        case "bearbeiter":
            return 2;
        default:
            return 1;
    }
}

function highestRole(roles: readonly TaskListRole[]) {
    if (roles.length === 0) {
        return null;
    }

    return roles.reduce((current, next) => (roleRank(next) > roleRank(current) ? next : current));
}

function isTaskOpen(status: TaskStatus) {
    return status !== "erledigt";
}

function intersects(values: readonly Id<"mitglied">[], selected: ReadonlySet<Id<"mitglied">>) {
    return values.some((value) => selected.has(value));
}

function relevantDate(task: Doc<"aufgabe">) {
    return task.ende ?? task.start ?? undefined;
}

function compareTaskOrder(left: Doc<"aufgabe">, right: Doc<"aufgabe">) {
    const leftDone = left.status === "erledigt";
    const rightDone = right.status === "erledigt";
    if (leftDone !== rightDone) {
        return leftDone ? 1 : -1;
    }

    const leftDate = relevantDate(left) ?? "9999-12-31";
    const rightDate = relevantDate(right) ?? "9999-12-31";
    if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate, "de");
    }

    return left.titel.localeCompare(right.titel, "de");
}

function compareUpcomingTasks(
    left: {
        title: string;
        start?: string;
        end?: string;
        status: TaskStatus;
    },
    right: {
        title: string;
        start?: string;
        end?: string;
        status: TaskStatus;
    },
) {
    const leftDate = left.end ?? left.start ?? "9999-12-31";
    const rightDate = right.end ?? right.start ?? "9999-12-31";
    if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate, "de");
    }

    const leftBlocked = left.status === "blockiert";
    const rightBlocked = right.status === "blockiert";
    if (leftBlocked !== rightBlocked) {
        return leftBlocked ? 1 : -1;
    }

    return left.title.localeCompare(right.title, "de");
}

function isUpcomingTask(task: Doc<"aufgabe">, startKey: string, endKey: string) {
    if (!isTaskOpen(task.status)) {
        return false;
    }

    const date = task.ende ?? task.start;
    if (!date) {
        return false;
    }

    return date >= startKey && date <= endKey;
}

function canEditTask(access: TaskListAccess, task: Doc<"aufgabe">) {
    return access.canEditAllTasks || intersects(task.zustaendige, access.myMitgliedIdSet);
}

function canViewAllTaskLists(permissionSet: ReadonlySet<Permission>) {
    return permissionSet.has(TASK_LIST_VIEW_ALL_PERMISSION);
}

async function hasAdminMembershipInVerein(ctx: ReadCtx, vereinId: Id<"verein">, mitgliedIds: readonly Id<"mitglied">[]) {
    if (mitgliedIds.length === 0) {
        return false;
    }

    const memberships = await loadMembershipsForMitgliedIds(ctx, mitgliedIds);
    const adminMemberships = memberships.filter((membership) => membership.rolle === "admin");

    if (adminMemberships.length === 0) {
        return false;
    }

    const listen = await Promise.all(adminMemberships.map((membership) => ctx.db.get(membership.listeId)));
    return listen.some((liste) => liste?.vereinId === vereinId);
}

async function getModuleContext(ctx: ReadCtx, vereinId: Id<"verein">): Promise<ModuleContext> {
    const access = await getVereinAccess(ctx, vereinId);
    const myMitgliedIds = access.mitglieder.map((mitglied) => mitglied._id);
    const hasCreatePermission = access.isOwner || LIST_CREATOR_PERMISSIONS.some((permission) => access.permissions.has(permission));
    let canCreateLists = hasCreatePermission && myMitgliedIds.length > 0;

    if (!canCreateLists && myMitgliedIds.length > 0) {
        canCreateLists = await hasAdminMembershipInVerein(ctx, vereinId, myMitgliedIds);
    }

    return {
        access,
        myMitgliedIds,
        myMitgliedIdSet: new Set(myMitgliedIds),
        canCreateLists,
    };
}

async function loadTaskListMemberships(ctx: ReadCtx, listeId: Id<"aufgaben_liste">) {
    return await ctx.db
        .query("aufgaben_liste_mitglied")
        .withIndex("by_listeId", (q) => q.eq("listeId", listeId))
        .collect();
}

async function loadMembershipsForMitgliedIds(ctx: ReadCtx, mitgliedIds: readonly Id<"mitglied">[]) {
    const result = await Promise.all(
        uniqueIds(mitgliedIds).map((mitgliedId) =>
            ctx.db
                .query("aufgaben_liste_mitglied")
                .withIndex("by_mitgliedId", (q) => q.eq("mitgliedId", mitgliedId))
                .collect(),
        ),
    );

    return result.flat();
}

async function ensureUniqueListName(ctx: MutationCtx, vereinId: Id<"verein">, name: string, excludeId?: Id<"aufgaben_liste">) {
    const existing = await ctx.db
        .query("aufgaben_liste")
        .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
        .collect();

    const duplicate = existing.find((liste) => liste._id !== excludeId && lower(liste.name) === lower(name));

    if (duplicate) {
        throw new Error("Eine Aufgabenliste mit diesem Namen existiert bereits");
    }
}

async function ensureMitgliederBelongToVerein(ctx: ReadCtx, vereinId: Id<"verein">, mitgliedIds: readonly Id<"mitglied">[]) {
    const uniqueMitgliedIds = uniqueIds(mitgliedIds);
    const mitglieder = await Promise.all(uniqueMitgliedIds.map((mitgliedId) => ctx.db.get(mitgliedId)));

    for (const mitglied of mitglieder) {
        if (!mitglied || mitglied.vereinId !== vereinId) {
            throw new Error("Mindestens eine ausgewählte Person gehört nicht zu diesem Verein");
        }
    }
}

async function validateListMembers(ctx: ReadCtx, vereinId: Id<"verein">, members: readonly { mitgliedId: Id<"mitglied">; rolle: TaskListRole }[]) {
    const normalizedMembers = uniqueIds(members.map((member) => member.mitgliedId));
    if (normalizedMembers.length !== members.length) {
        throw new Error("Jede Person darf in einer Liste nur einmal vorkommen");
    }

    await ensureMitgliederBelongToVerein(ctx, vereinId, normalizedMembers);

    if (!members.some((member) => member.rolle === "admin")) {
        throw new Error("Mindestens eine Person muss Admin der Liste sein");
    }
}

async function replaceListMembers(ctx: MutationCtx, listeId: Id<"aufgaben_liste">, vereinId: Id<"verein">, members: readonly { mitgliedId: Id<"mitglied">; rolle: TaskListRole }[]) {
    await validateListMembers(ctx, vereinId, members);

    const existing = await loadTaskListMemberships(ctx, listeId);
    await Promise.all(existing.map((entry) => ctx.db.delete(entry._id)));
    await Promise.all(
        members.map((member) =>
            ctx.db.insert("aufgaben_liste_mitglied", {
                listeId,
                vereinId,
                mitgliedId: member.mitgliedId,
                rolle: member.rolle,
            }),
        ),
    );
}

async function getTaskListAccess(ctx: ReadCtx, listeId: Id<"aufgaben_liste">): Promise<TaskListAccess> {
    const liste = await ctx.db.get(listeId);
    if (!liste) {
        throw new Error("Aufgabenliste nicht gefunden");
    }

    const moduleContext = await getModuleContext(ctx, liste.vereinId);
    const memberships = await loadTaskListMemberships(ctx, listeId);

    if (moduleContext.access.isOwner) {
        return {
            ...moduleContext,
            liste,
            memberships,
            role: "admin",
            canManageMembers: true,
            canEditAllTasks: true,
            canCreateTasks: true,
            canDeleteTasks: true,
            canDeleteList: true,
        };
    }

    const role = highestRole(memberships.filter((membership) => moduleContext.myMitgliedIdSet.has(membership.mitgliedId)).map((membership) => membership.rolle));

    if (!role) {
        if (!canViewAllTaskLists(moduleContext.access.permissions)) {
            throw new Error("Access denied");
        }

        return {
            ...moduleContext,
            liste,
            memberships,
            role: "mitarbeiter",
            canManageMembers: false,
            canEditAllTasks: false,
            canCreateTasks: false,
            canDeleteTasks: false,
            canDeleteList: false,
        };
    }

    return {
        ...moduleContext,
        liste,
        memberships,
        role,
        canManageMembers: role === "admin",
        canEditAllTasks: role === "admin" || role === "bearbeiter",
        canCreateTasks: role === "admin" || role === "bearbeiter",
        canDeleteTasks: role === "admin" || role === "bearbeiter",
        canDeleteList: role === "admin",
    };
}

async function ensureTaskDependencies(ctx: ReadCtx, listeId: Id<"aufgaben_liste">, dependencyIds: readonly Id<"aufgabe">[], excludeTaskId?: Id<"aufgabe">) {
    const uniqueDependencyIds = uniqueIds(dependencyIds);
    const dependencies = await Promise.all(uniqueDependencyIds.map((taskId) => ctx.db.get(taskId)));

    for (const dependency of dependencies) {
        if (!dependency || dependency.listeId !== listeId) {
            throw new Error("Abhängigkeiten müssen Aufgaben derselben Liste referenzieren");
        }

        if (excludeTaskId && dependency._id === excludeTaskId) {
            throw new Error("Eine Aufgabe kann nicht von sich selbst abhängen");
        }
    }
}

async function ensureTaskAssignees(ctx: ReadCtx, listeId: Id<"aufgaben_liste">, assigneeIds: readonly Id<"mitglied">[], memberships?: readonly TaskListMembership[]) {
    const currentMemberships = memberships ?? (await loadTaskListMemberships(ctx, listeId));
    const allowedIds = new Set(currentMemberships.map((membership) => membership.mitgliedId));

    for (const assigneeId of uniqueIds(assigneeIds)) {
        if (!allowedIds.has(assigneeId)) {
            throw new Error("Verantwortliche Personen müssen Mitglied der Aufgabenliste sein");
        }
    }
}

async function loadAccessibleLists(ctx: ReadCtx, vereinId: Id<"verein">, moduleContext: ModuleContext) {
    const lists = await ctx.db
        .query("aufgaben_liste")
        .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
        .collect();

    if (moduleContext.access.isOwner || canViewAllTaskLists(moduleContext.access.permissions)) {
        return lists;
    }

    const myMemberships = await loadMembershipsForMitgliedIds(ctx, moduleContext.myMitgliedIds);
    const allowedListIds = new Set(myMemberships.map((membership) => membership.listeId));

    return lists.filter((liste) => allowedListIds.has(liste._id));
}

export const overview = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        const moduleContext = await getModuleContext(ctx, vereinId);
        const accessibleLists = await loadAccessibleLists(ctx, vereinId, moduleContext);
        const today = todayKey();
        const upcomingLimit = addDays(today, TODAY_UPCOMING_WINDOW_DAYS);

        const listSummaries = await Promise.all(
            accessibleLists.map(async (liste) => {
                const [memberships, tasks] = await Promise.all([
                    loadTaskListMemberships(ctx, liste._id),
                    ctx.db
                        .query("aufgabe")
                        .withIndex("by_listeId", (q) => q.eq("listeId", liste._id))
                        .collect(),
                ]);

                const role = moduleContext.access.isOwner
                    ? "admin"
                    : (highestRole(memberships.filter((membership) => moduleContext.myMitgliedIdSet.has(membership.mitgliedId)).map((membership) => membership.rolle)) ?? "mitarbeiter");

                return {
                    _id: liste._id,
                    name: liste.name,
                    beschreibung: liste.beschreibung,
                    role,
                    memberCount: memberships.length,
                    taskCount: tasks.length,
                    openTaskCount: tasks.filter((task) => isTaskOpen(task.status)).length,
                    assignedToMeCount: tasks.filter((task) => isTaskOpen(task.status) && intersects(task.zustaendige, moduleContext.myMitgliedIdSet)).length,
                    upcomingCount: tasks.filter((task) => isUpcomingTask(task, today, upcomingLimit)).length,
                    canManageMembers: role === "admin",
                    canCreateTasks: role === "admin" || role === "bearbeiter",
                };
            }),
        );

        const allTasks = (
            await Promise.all(
                accessibleLists.map((liste) =>
                    ctx.db
                        .query("aufgabe")
                        .withIndex("by_listeId", (q) => q.eq("listeId", liste._id))
                        .collect()
                        .then((tasks) =>
                            tasks.map((task) => ({
                                task,
                                listeId: liste._id,
                                listeName: liste.name,
                            })),
                        ),
                ),
            )
        ).flat();

        const upcomingMine = allTasks
            .filter(({ task }) => {
                if (!isTaskOpen(task.status)) {
                    return false;
                }

                if (!intersects(task.zustaendige, moduleContext.myMitgliedIdSet)) {
                    return false;
                }

                return Boolean(task.start || task.ende);
            })
            .sort((left, right) =>
                compareUpcomingTasks(
                    {
                        title: left.task.titel,
                        start: left.task.start,
                        end: left.task.ende,
                        status: left.task.status,
                    },
                    {
                        title: right.task.titel,
                        start: right.task.start,
                        end: right.task.ende,
                        status: right.task.status,
                    },
                ),
            )
            .slice(0, 5)
            .map(({ task, listeId, listeName }) => ({
                _id: task._id,
                listeId,
                listeName,
                titel: task.titel,
                status: task.status,
                start: task.start,
                ende: task.ende,
            }));

        return {
            canCreateLists: moduleContext.canCreateLists,
            canOpenModule: moduleContext.canCreateLists || canViewAllTaskLists(moduleContext.access.permissions) || accessibleLists.length > 0,
            myMitgliedIds: moduleContext.myMitgliedIds,
            totalAccessibleLists: accessibleLists.length,
            totalOpenTasks: allTasks.filter(({ task }) => isTaskOpen(task.status)).length,
            assignedOpenTasks: allTasks.filter(({ task }) => isTaskOpen(task.status) && intersects(task.zustaendige, moduleContext.myMitgliedIdSet)).length,
            upcomingMineCount: upcomingMine.length,
            accessibleLists: listSummaries.sort((left, right) => left.name.localeCompare(right.name, "de")),
            upcomingMine,
        };
    },
});

export const availableMembers = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        await getModuleContext(ctx, vereinId);

        const mitglieder = await ctx.db
            .query("mitglied")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
            .collect();

        return mitglieder
            .map((mitglied) => ({
                _id: mitglied._id,
                vorname: mitglied.vorname,
                nachname: mitglied.nachname,
                name: `${mitglied.vorname} ${mitglied.nachname}`.trim(),
                email: mitglied.kontakt.email,
                typ: mitglied.typ,
            }))
            .sort((left, right) => left.name.localeCompare(right.name, "de"));
    },
});

export const listDetails = query({
    args: {
        listeId: v.id("aufgaben_liste"),
    },
    handler: async (ctx, { listeId }) => {
        const access = await getTaskListAccess(ctx, listeId);
        const [taskDocs, membersWithDocs] = await Promise.all([
            ctx.db
                .query("aufgabe")
                .withIndex("by_listeId", (q) => q.eq("listeId", listeId))
                .collect(),
            Promise.all(
                access.memberships.map(async (membership) => ({
                    membership,
                    mitglied: await ctx.db.get(membership.mitgliedId),
                })),
            ),
        ]);

        const validMembers = membersWithDocs.filter(
            (
                item,
            ): item is {
                membership: TaskListMembership;
                mitglied: Doc<"mitglied">;
            } => Boolean(item.mitglied && item.mitglied.vereinId === access.liste.vereinId),
        );

        const taskMap = new Map(taskDocs.map((task) => [task._id, task]));
        const memberNameMap = new Map(validMembers.map(({ mitglied }) => [mitglied._id, `${mitglied.vorname} ${mitglied.nachname}`.trim()]));

        return {
            list: {
                _id: access.liste._id,
                vereinId: access.liste.vereinId,
                name: access.liste.name,
                beschreibung: access.liste.beschreibung,
                createdAt: access.liste.createdAt,
                role: access.role,
                canManageMembers: access.canManageMembers,
                canCreateTasks: access.canCreateTasks,
                canDeleteList: access.canDeleteList,
                canEditAllTasks: access.canEditAllTasks,
            },
            members: validMembers
                .map(({ membership, mitglied }) => ({
                    mitgliedId: mitglied._id,
                    name: `${mitglied.vorname} ${mitglied.nachname}`.trim(),
                    email: mitglied.kontakt.email,
                    rolle: membership.rolle,
                }))
                .sort((left, right) => left.name.localeCompare(right.name, "de")),
            tasks: taskDocs
                .slice()
                .sort(compareTaskOrder)
                .map((task) => ({
                    _id: task._id,
                    titel: task.titel,
                    beschreibung: task.beschreibung,
                    start: task.start,
                    ende: task.ende,
                    status: task.status,
                    abhaengigkeiten: task.abhaengigkeiten,
                    zustaendige: task.zustaendige,
                    zustaendigeNamen: task.zustaendige.map((mitgliedId) => memberNameMap.get(mitgliedId)).filter((value): value is string => Boolean(value)),
                    dependencies: task.abhaengigkeiten
                        .map((taskId) => {
                            const dependency = taskMap.get(taskId);
                            if (!dependency) {
                                return null;
                            }

                            return {
                                _id: dependency._id,
                                titel: dependency.titel,
                                status: dependency.status,
                            };
                        })
                        .filter(
                            (
                                dependency,
                            ): dependency is {
                                _id: Id<"aufgabe">;
                                titel: string;
                                status: TaskStatus;
                            } => dependency !== null,
                        ),
                    canEdit: canEditTask(access, task),
                    canDelete: access.canDeleteTasks,
                    isAssignedToMe: intersects(task.zustaendige, access.myMitgliedIdSet),
                })),
        };
    },
});

export const createList = mutation({
    args: {
        vereinId: v.id("verein"),
        name: v.string(),
        beschreibung: v.optional(v.string()),
    },
    handler: async (ctx, { vereinId, name, beschreibung }) => {
        const moduleContext = await getModuleContext(ctx, vereinId);
        const canCreateLists = moduleContext.canCreateLists || (await hasAdminMembershipInVerein(ctx, vereinId, moduleContext.myMitgliedIds));
        if (!canCreateLists) {
            throw new Error("Nur Vereinsadmins können Aufgabenlisten anlegen");
        }

        const normalizedName = trimAndNormalize(name);
        if (!normalizedName) {
            throw new Error("Bitte gib einen Namen für die Aufgabenliste ein");
        }

        const ownMitgliedId = getOwnMitgliedId(moduleContext);

        await ensureUniqueListName(ctx, vereinId, normalizedName);

        const listeId = await ctx.db.insert("aufgaben_liste", {
            vereinId,
            name: normalizedName,
            beschreibung: normalizeOptionalText(beschreibung),
            createdAt: nowIso(),
            updatedAt: nowIso(),
            createdBy: moduleContext.access.userSubject,
        });

        await replaceListMembers(ctx, listeId, vereinId, [{ mitgliedId: ownMitgliedId, rolle: "admin" }]);
        return listeId;
    },
});

export const updateList = mutation({
    args: {
        listeId: v.id("aufgaben_liste"),
        name: v.string(),
        beschreibung: v.optional(v.string()),
    },
    handler: async (ctx, { listeId, name, beschreibung }) => {
        const access = await getTaskListAccess(ctx, listeId);
        if (!access.canManageMembers) {
            throw new Error("Nur Listenadmins können die Liste bearbeiten");
        }

        const normalizedName = trimAndNormalize(name);
        if (!normalizedName) {
            throw new Error("Bitte gib einen Namen für die Aufgabenliste ein");
        }

        await ensureUniqueListName(ctx, access.liste.vereinId, normalizedName, listeId);

        await ctx.db.patch(listeId, {
            name: normalizedName,
            beschreibung: normalizeOptionalText(beschreibung),
            updatedAt: nowIso(),
        });

        return listeId;
    },
});

export const updateListMembers = mutation({
    args: {
        listeId: v.id("aufgaben_liste"),
        members: v.array(taskListMemberValidator),
    },
    handler: async (ctx, { listeId, members }) => {
        const access = await getTaskListAccess(ctx, listeId);
        if (!access.canManageMembers) {
            throw new Error("Nur Listenadmins können Personen verwalten");
        }

        await replaceListMembers(ctx, listeId, access.liste.vereinId, members);
        await ctx.db.patch(listeId, {
            updatedAt: nowIso(),
        });

        return listeId;
    },
});

export const removeList = mutation({
    args: {
        listeId: v.id("aufgaben_liste"),
    },
    handler: async (ctx, { listeId }) => {
        const access = await getTaskListAccess(ctx, listeId);
        if (!access.canDeleteList) {
            throw new Error("Nur Listenadmins können Aufgabenlisten löschen");
        }

        const [memberships, tasks] = await Promise.all([
            loadTaskListMemberships(ctx, listeId),
            ctx.db
                .query("aufgabe")
                .withIndex("by_listeId", (q) => q.eq("listeId", listeId))
                .collect(),
        ]);

        await Promise.all(memberships.map((membership) => ctx.db.delete(membership._id)));
        await Promise.all(tasks.map((task) => ctx.db.delete(task._id)));
        await ctx.db.delete(listeId);

        return listeId;
    },
});

export const createTask = mutation({
    args: {
        listeId: v.id("aufgaben_liste"),
        titel: v.string(),
        beschreibung: v.optional(v.string()),
        start: v.optional(v.string()),
        ende: v.optional(v.string()),
        abhaengigkeiten: v.array(v.id("aufgabe")),
        zustaendige: v.array(v.id("mitglied")),
        status: taskStatusValidator,
    },
    handler: async (ctx, { listeId, titel, beschreibung, start, ende, abhaengigkeiten, zustaendige, status }) => {
        const access = await getTaskListAccess(ctx, listeId);
        if (!access.canCreateTasks) {
            throw new Error("Nur Listenadmins oder Bearbeiter können Aufgaben anlegen");
        }

        const normalizedTitle = trimAndNormalize(titel);
        if (!normalizedTitle) {
            throw new Error("Bitte gib einen Aufgabentitel ein");
        }

        const normalizedStart = normalizeDate(start);
        const normalizedEnd = normalizeDate(ende);
        if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
            throw new Error("Das Enddatum darf nicht vor dem Startdatum liegen");
        }

        const uniqueDependencies = uniqueIds(abhaengigkeiten);
        const uniqueAssignees = uniqueIds(zustaendige);

        await ensureTaskDependencies(ctx, listeId, uniqueDependencies);
        await ensureTaskAssignees(ctx, listeId, uniqueAssignees, access.memberships);

        return await ctx.db.insert("aufgabe", {
            vereinId: access.liste.vereinId,
            listeId,
            titel: normalizedTitle,
            beschreibung: normalizeOptionalText(beschreibung),
            start: normalizedStart,
            ende: normalizedEnd,
            abhaengigkeiten: uniqueDependencies,
            zustaendige: uniqueAssignees,
            status,
            createdAt: nowIso(),
            updatedAt: nowIso(),
        });
    },
});

export const updateTask = mutation({
    args: {
        taskId: v.id("aufgabe"),
        titel: v.string(),
        beschreibung: v.optional(v.string()),
        start: v.optional(v.string()),
        ende: v.optional(v.string()),
        abhaengigkeiten: v.array(v.id("aufgabe")),
        zustaendige: v.array(v.id("mitglied")),
        status: taskStatusValidator,
    },
    handler: async (ctx, { taskId, titel, beschreibung, start, ende, abhaengigkeiten, zustaendige, status }) => {
        const task = await ctx.db.get(taskId);
        if (!task) {
            throw new Error("Aufgabe nicht gefunden");
        }

        const access = await getTaskListAccess(ctx, task.listeId);
        if (!canEditTask(access, task)) {
            throw new Error("Du darfst diese Aufgabe nicht bearbeiten");
        }

        const normalizedTitle = trimAndNormalize(titel);
        if (!normalizedTitle) {
            throw new Error("Bitte gib einen Aufgabentitel ein");
        }

        const normalizedStart = normalizeDate(start);
        const normalizedEnd = normalizeDate(ende);
        if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
            throw new Error("Das Enddatum darf nicht vor dem Startdatum liegen");
        }

        const uniqueDependencies = uniqueIds(abhaengigkeiten);
        const uniqueAssignees = uniqueIds(zustaendige);

        await ensureTaskDependencies(ctx, task.listeId, uniqueDependencies, taskId);
        await ensureTaskAssignees(ctx, task.listeId, uniqueAssignees, access.memberships);

        await ctx.db.patch(taskId, {
            titel: normalizedTitle,
            beschreibung: normalizeOptionalText(beschreibung),
            start: normalizedStart,
            ende: normalizedEnd,
            abhaengigkeiten: uniqueDependencies,
            zustaendige: uniqueAssignees,
            status,
            updatedAt: nowIso(),
        });

        return taskId;
    },
});

export const removeTask = mutation({
    args: {
        taskId: v.id("aufgabe"),
    },
    handler: async (ctx, { taskId }) => {
        const task = await ctx.db.get(taskId);
        if (!task) {
            throw new Error("Aufgabe nicht gefunden");
        }

        const access = await getTaskListAccess(ctx, task.listeId);
        if (!access.canDeleteTasks) {
            throw new Error("Nur Listenadmins oder Bearbeiter können Aufgaben löschen");
        }

        const dependentTasks = await ctx.db
            .query("aufgabe")
            .withIndex("by_listeId", (q) => q.eq("listeId", task.listeId))
            .collect();

        await Promise.all(
            dependentTasks
                .filter((entry) => entry.abhaengigkeiten.includes(taskId))
                .map((entry) =>
                    ctx.db.patch(entry._id, {
                        abhaengigkeiten: entry.abhaengigkeiten.filter((id) => id !== taskId),
                        updatedAt: nowIso(),
                    }),
                ),
        );

        await ctx.db.delete(taskId);
        return taskId;
    },
});
