# Source workbook

Put your copy of the Excel workbook (for example `Pokemon_Dataset_1.xlsx`) in this folder, then rebuild the game data from the project root:

```bash
pip install -r scripts/requirements.txt
python scripts/build_data.py data/source/Pokemon_Dataset_1.xlsx
```

`.xlsx` files in this folder are listed in `.gitignore`, so the workbook itself is never uploaded to GitHub. Only the generated `data/pokemon.json` is.
