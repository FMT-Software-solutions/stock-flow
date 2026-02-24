import { differenceInDays, parseISO } from 'date-fns';

export interface TrialInfo {
    isExpired: boolean;
    daysRemaining: number;
    hasPurchased: boolean;
    isActiveTrial: boolean;
}

export interface OrganizationLike {
    id: string;
    name?: string;
    has_purchased?: boolean;
    trial_end_date?: string | null;
}

export function useTrialStatus(organization?: OrganizationLike | null): TrialInfo {
    if (!organization) {
        return {
            isExpired: false,
            daysRemaining: 0,
            hasPurchased: false,
            isActiveTrial: false,
        };
    }

    if (organization.has_purchased) {
        return {
            isExpired: false,
            daysRemaining: 0,
            hasPurchased: true,
            isActiveTrial: false,
        };
    }

    if (!organization.trial_end_date) {
        // If not purchased and no trial date, assume not expired (or infinite trial/free tier)
        return {
            isExpired: false,
            daysRemaining: 0,
            hasPurchased: false,
            isActiveTrial: false,
        };
    }

    const daysRemaining = differenceInDays(
        parseISO(organization.trial_end_date),
        new Date()
    );

    const isExpired = daysRemaining < 0;

    return {
        isExpired,
        daysRemaining,
        hasPurchased: false,
        isActiveTrial: !isExpired,
    };
}
