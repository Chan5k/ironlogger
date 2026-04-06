#!/usr/bin/env bash
LINE="alias webapp='cd /mnt/c/Users/Matei/Desktop/webapp1'"
if ! grep -qF "$LINE" ~/.bashrc 2>/dev/null; then
  printf '\n# IronLog / webapp1 — quick cd to Windows project\n%s\n' "$LINE" >> ~/.bashrc
  echo "Added to ~/.bashrc. Run: source ~/.bashrc  (or open a new terminal)"
else
  echo "Already present in ~/.bashrc"
fi
