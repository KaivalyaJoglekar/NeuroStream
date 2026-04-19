# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw

COPY src/ src/
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app

COPY --from=build /app/target/MS6-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8086
ENTRYPOINT ["java", "-jar", "app.jar"]
