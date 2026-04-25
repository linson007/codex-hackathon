# Open Source Spring Boot Smoke Test

This test indexes the real open-source Spring Petclinic project to validate ContextOS outside the curated retail sample.

## Clone

```bash
mkdir -p samples/open-source
git clone --depth 1 https://github.com/spring-projects/spring-petclinic.git samples/open-source/spring-petclinic
```

`samples/open-source/` is gitignored so the downloaded project stays local.

## Index

```bash
./bin/contextos.js init spring-petclinic
./bin/contextos.js repos add spring-petclinic samples/open-source/spring-petclinic
./bin/contextos.js update spring-petclinic --verbose
```

Observed result after scanner improvements:

```text
Indexed spring-petclinic: 146 nodes, 151 edges
```

Export summary:

```text
repositories: 1
endpoints: 18
service components: 12
logical tables: 7
topics: 0
controllers: CrashController, OwnerController, PetController, VetController, VisitController, WelcomeController
```

## Generate Docs Without OpenAI

```bash
OPENAI_API_KEY= ./bin/contextos.js docs generate spring-petclinic --force --verbose
```

This creates deterministic fallback docs for the repository, MVC controllers, Spring Data repositories, and endpoints.

## Ask

```bash
OPENAI_API_KEY= ./bin/contextos.js ask spring-petclinic "What is impacted if I change owner creation flow?" --with-docs --verbose
```

Expected themes:

- `OwnerController` and `OwnerRepository`.
- Owner endpoints such as `GET /owners/new`, `POST /owners/new`, `GET /owners`, and `GET /owners/{ownerId}`.
- Related owner/pet/visit tables and entities.
- Suggested files under `src/main/java/org/springframework/samples/petclinic/owner`.

## Scanner Learnings

The first run found tables but missed MVC controllers because Petclinic uses `@Controller`, not `@RestController`. The scanner was updated to detect:

- Spring MVC `@Controller`.
- Spring Data repository interfaces extending `Repository`, `CrudRepository`, or `JpaRepository`.
- SQL tables from any `.sql` file, including `schema.sql`, not only Flyway-style `V*_*.sql` migrations.
