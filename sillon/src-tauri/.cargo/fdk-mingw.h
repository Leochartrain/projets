/* Inclus d'office (-include) dans chaque fichier C compilé pour Windows GNU.
   N'agit que sur le C++ : seul FDK AAC en contient ici. Sous MinGW 64 bits, l'en-tête common_fix.h de FDK
   déclare deux fois fMin/fMax ; sa configuration « 64 bits Linux » (__LP64__) évite le doublon, avec les
   mêmes tailles de types que Windows (INT et LONG sur 4 octets). Le C (SQLite…) n'est pas concerné. */
#if defined(__cplusplus) && !defined(__LP64__)
#define __LP64__ 1
#endif
