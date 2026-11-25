import { addons } from "storybook/manager-api";

import { systemTheme } from "./theme.ts";

addons.setConfig({ theme: systemTheme() });
