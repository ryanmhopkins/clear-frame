# Extended photo regression fixtures

- CanonRaw.cr2, DNG.dng, QuickTime.heic, GIF.gif: ExifTool test corpus at
  https://github.com/exiftool/exiftool/tree/2200871d9cef988051d2a99d67df3bda6cbb30a8/t/images
  (same Perl Artistic/GPL licensing as ExifTool). These small files exercise container
  handling; they are not all complete camera pictures. The GIF is a real 8×8 image.
- Sony.arw: Sony ILCE-7S, RAW sample 1582, CC0, https://raw.pixls.us/getfile.php/1582/nice/
- Nikon.nef: Nikon D2H, RAW sample 5227, CC0, https://raw.pixls.us/getfile.php/5227/nice/
- Camera.dng: Adobe DNG Converter / Canon EOS 5D Mark III, RAW sample 1033,
  CC0, https://raw.pixls.us/getfile.php/1033/nice/
- image.avif, image.tiff: original 32×24 solid blue images generated with sharp.

Except GIF, fixtures have seeded GPS, Artist and XMP Title fields for removal tests.
Camera originals retain their original maker notes; they are public test samples.
No user photos are included. License text: ../../../vendor/exiftool/ARTISTIC-PERL.
