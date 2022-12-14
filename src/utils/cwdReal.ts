// process.env.INIT_CWD is a "soft standard" followed by npm, Yarn and pnpm: https://github.com/vercel/turbo/issues/485
export const cwdReal = process.env.INIT_CWD || process.cwd()
