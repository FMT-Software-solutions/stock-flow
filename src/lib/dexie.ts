import Dexie, { type Table } from 'dexie';
import type { CompleteTheme } from '@/types/theme';

export interface OrgThemeRecord {
    id: string;
    orgId?: string;
    selectedThemeKey: string;
    selectedTheme: CompleteTheme;
    updatedAt: number;
}

export interface OrgKVRecord<T = unknown> {
    id: string;
    orgId: string;
    key: string;
    userId?: string;
    value: T;
    updatedAt: number;
}

class StockFlowDB extends Dexie {
    orgThemes!: Table<OrgThemeRecord, string>;
    orgKV!: Table<OrgKVRecord, string>;

    constructor() {
        super('StockFlowDB');
        this.version(1).stores({
            orgThemes: 'id, selectedThemeKey, updatedAt',
            orgKV: 'id, orgId, key, userId, updatedAt',
        });
    }
}

export const db = new StockFlowDB();

export async function getOrgTheme(organizationId: string): Promise<OrgThemeRecord | undefined> {
    try {
        return await db.orgThemes.get(organizationId);
    } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        if (name === 'DatabaseClosedError' || name === 'UpgradeError') {
            await db.delete();
            await db.open();
            return db.orgThemes.get(organizationId);
        }
        throw error;
    }
}

export async function setOrgTheme(
    organizationId: string,
    selectedThemeKey: string,
    selectedTheme: CompleteTheme
): Promise<void> {
    try {
        await db.transaction('rw', db.orgThemes, async () => {
            await db.orgThemes.put({
                id: organizationId,
                orgId: organizationId,
                selectedThemeKey,
                selectedTheme,
                updatedAt: Date.now(),
            });
        });
    } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        if (name === 'DatabaseClosedError' || name === 'UpgradeError') {
            await db.delete();
            await db.open();
            await db.orgThemes.put({
                id: organizationId,
                orgId: organizationId,
                selectedThemeKey,
                selectedTheme,
                updatedAt: Date.now(),
            });
            return;
        }
        throw error;
    }
}

export async function clearOrgTheme(organizationId: string): Promise<void> {
    try {
        await db.orgThemes.delete(organizationId);
    } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        if (name === 'DatabaseClosedError' || name === 'UpgradeError') {
            await db.delete();
            await db.open();
            await db.orgThemes.delete(organizationId);
            return;
        }
        throw error;
    }
}

export async function getOrgKV<T = unknown>(
    organizationId: string,
    key: string,
    userId?: string
): Promise<T | undefined> {
    const id = userId ? `${organizationId}:${key}:${userId}` : `${organizationId}:${key}`;
    try {
        const row = await db.orgKV.get(id);
        return row?.value as T | undefined;
    } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        if (name === 'DatabaseClosedError' || name === 'UpgradeError') {
            await db.delete();
            await db.open();
            const row = await db.orgKV.get(id);
            return row?.value as T | undefined;
        }
        throw error;
    }
}

export async function setOrgKV<T = unknown>(
    organizationId: string,
    key: string,
    value: T,
    userId?: string
): Promise<void> {
    const id = userId ? `${organizationId}:${key}:${userId}` : `${organizationId}:${key}`;
    try {
        await db.transaction('rw', db.orgKV, async () => {
            await db.orgKV.put({
                id,
                orgId: organizationId,
                key,
                userId,
                value,
                updatedAt: Date.now(),
            });
        });
    } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        if (name === 'DatabaseClosedError' || name === 'UpgradeError') {
            await db.delete();
            await db.open();
            await db.orgKV.put({
                id,
                orgId: organizationId,
                key,
                userId,
                value,
                updatedAt: Date.now(),
            });
            return;
        }
        throw error;
    }
}

export async function deleteOrgKV(
    organizationId: string,
    key: string,
    userId?: string
): Promise<void> {
    const id = userId ? `${organizationId}:${key}:${userId}` : `${organizationId}:${key}`;
    try {
        await db.orgKV.delete(id);
    } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        if (name === 'DatabaseClosedError' || name === 'UpgradeError') {
            await db.delete();
            await db.open();
            await db.orgKV.delete(id);
            return;
        }
        throw error;
    }
}

