import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function WelcomePage() {
  return (
    <main
      style={{
        minHeight: "100svh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "max(32px, env(safe-area-inset-top))",
        paddingRight: "clamp(24px, 7vw, 72px)",
        paddingBottom: "max(32px, env(safe-area-inset-bottom))",
        paddingLeft: "clamp(24px, 7vw, 72px)",
        background: "#FFFFFF",
        color: "#1F2937",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
          marginTop: "clamp(40px, 10vh, 180px)",
        }}
      >
        <BrandMark size={56} />
        <span
          style={{
            margin: 0,
            color: "#1F2937",
            fontSize: "clamp(28px, 7vw, 38px)",
            fontWeight: 750,
            letterSpacing: "0.015em",
            lineHeight: 1,
          }}
        >
          STUDLY
        </span>
      </header>

      <section
        aria-labelledby="welcome-title"
        style={{
          width: "100%",
          maxWidth: "760px",
          flex: 1,
          minHeight: "240px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: "clamp(72px, 21vh, 380px)",
          textAlign: "center",
        }}
      >
        <h1
          id="welcome-title"
          style={{
            margin: "0 0 20px",
            color: "#1F2937",
            fontSize: "clamp(30px, 5.2vw, 58px)",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1.16,
          }}
        >
          Добро пожаловать!
        </h1>
        <p
          style={{
            maxWidth: "680px",
            margin: 0,
            color: "#94A3B8",
            fontSize: "clamp(17px, 2.6vw, 26px)",
            lineHeight: 1.55,
            textWrap: "pretty",
          }}
        >
          Находите нужную помощь, делитесь знаниями и развивайтесь вместе со STUDLY.
        </p>
      </section>

      <footer
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "clamp(20px, 6vh, 96px)",
        }}
      >
        <Link
          href="/register/roles"
          style={{
            width: "100%",
            maxWidth: "740px",
            minHeight: "58px",
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "16px",
            background: "#3547B8",
            color: "#FFFFFF",
            fontSize: "18px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Начать
        </Link>
        <p
          style={{
            margin: "16px 0 0",
            color: "#94A3B8",
            fontSize: "15px",
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          Платформа студенческих услуг
        </p>
      </footer>
    </main>
  );
}
