# MaximizeToWorkspace

Fork of https://github.com/rliang/gnome-shell-extension-maximize-to-workspace with added history support

Took some elements from https://github.com/satran/fullscreenworkspace-satran.in that adds some basic history tracking

***

## What does this do?
When a window is maximized this extension moves the window to the first empty workspace it can find. When it is unmaximized the window is brought back to the original workspace it was present in, if possible.

***

To install run:
```
git clone https://github.com/raonetwo/MaximizeToWorkspace.git ~/.local/share/gnome-shell/extensions/maximize-to-workspace@raonetwo.github.com
gnome-extensions enable maximize-to-workspace@raonetwo.github.com
```

Then press Alt + F2 and in the dialogue box press "r" (no quotes) and enter to refresh the gnome session and verify that the extension has been enabled

***

This extension is best utilized with multi finger gestures are enabled e.g. using Fusuma.

Or you can use keyboard shortcuts for quick navigation.

***

This has been tested on Ubuntu 19.10 on gnome version 3.34.2, contribution are accepted for following:
1. Test it out with other gnome shell versions and update metadata.json.
2. Currently a few things are set as default like start with second workspace, no default workspace if you run out of workspaces in static workspace mode, etc. These parameters need to be exposed and set based on user preference.
3. If you find any bug in testing, want some new feature/do some basic refactoring /clean up.
