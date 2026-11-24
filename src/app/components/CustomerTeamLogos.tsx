"use client";
// Shows approved customer team logos with a pausable loop and a static reduced-motion layout.
import Image from "next/image";
import { useState } from "react";

const teams = [
  { name: "West Michigan Ice Dogs", logo: "/images/team-logos/west-michigan-ice-dogs.webp" },
  { name: "Lakeshore Jr. Lumberjacks", logo: "/images/team-logos/jr-jacks.webp" },
  { name: "Charleston Jr. Stingrays", logo: "/images/team-logos/charleston-jr-stingrays.webp" },
  { name: "Greenville Rage", logo: "/images/team-logos/greenville-rage.webp" },
] as const;

export function CustomerTeamLogos() {
  const [paused, setPaused] = useState(false);

  return (
    <section className="customer-team-logos" aria-labelledby="customer-teams-heading">
      <h2 id="customer-teams-heading" className="customer-team-logos-heading">Teams using Puck Buddy</h2>
      <div className="customer-team-logos-viewport">
        <div className="customer-team-logos-track" data-paused={paused}>
          {[false, true].map((duplicate) => (
            <ul
              key={duplicate ? "loop" : "teams"}
              role="list"
              className={duplicate ? "customer-team-logos-group customer-team-logos-duplicate" : "customer-team-logos-group"}
              aria-hidden={duplicate || undefined}
            >
              {teams.map(({ name, logo }) => (
                <li key={name} className="customer-team-logos-team">
                  <Image
                    src={logo}
                    width={120}
                    height={80}
                    alt=""
                    unoptimized
                    loading="eager"
                    fetchPriority="low"
                    className="customer-team-logos-logo"
                  />
                  <span>{name}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
        <button
          type="button"
          className="customer-team-logos-interaction"
          aria-label={paused ? "Resume moving team logos" : "Pause moving team logos"}
          onClick={() => setPaused((isPaused) => !isPaused)}
        />
      </div>
    </section>
  );
}
