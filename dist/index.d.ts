declare function cmdInit(options: {
    budget?: number;
    depth?: "recent" | "inception";
    commits?: number;
    silent?: boolean;
}): Promise<void>;
declare function cmdUpdate(options: {
    silent?: boolean;
}): Promise<void>;
declare function cmdStatus(): Promise<void>;
declare function cmdShow(): Promise<void>;
declare function cmdConfig(options: {
    budget?: number;
    maxCommits?: number;
    recentDays?: number;
    syncDepth?: "recent" | "inception";
    syncCommits?: number;
    autoInject?: boolean;
    askBefore?: boolean;
}): Promise<void>;
declare function cmdInstallHook(): Promise<void>;
declare function cmdTimeMachine(action: string, args: string[]): Promise<void>;

export { cmdConfig, cmdInit, cmdInstallHook, cmdShow, cmdStatus, cmdTimeMachine, cmdUpdate };
