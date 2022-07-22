# Dev My Dep

Little tool to seamlessly develop dependencies.

```bash
# Install `dev-my-dep`
$ pnpm install --dev @brillout/dev-my-dep
# Develop `some-dependency`
$ pnpm exec dev-my-dep some-dependency
```

1. Automatically fetches the Git repository of `some-dependency` at `$root/deps/some-dependency/`

   > `$root` is your pnpm workspace's root directory.

   > Add `/deps/` to `$root/.gitignore`.

   > `dev-my-dep` determines the Git repository's URL by reading `some-dependency`'s `package.json#repository`.

1. Automatically runs `pnpm install` in `$root/deps/some-dependency/`
1. Automatically symlinks `$cwd/node_modules/some-dependency/` to `$root/deps/some-dependency/`.
   > `$cwd` is the current working directory (`process.cwd()`)

   > You need to run the `dev-my-dep` CLI at the workspace's package that uses `some-dependency`.

1. Prints the version status of `some-dependency`.
   ```
   Current semver: some-dependency@^0.1.0
   Latest version: some-dependency@0.1.0
   ```

> Only works with `pnpm`. (Supporting other package managers is a non-goal.)
