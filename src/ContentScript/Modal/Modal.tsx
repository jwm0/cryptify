import React from "react";

type Props = {
  header: string;
  description?: string;
  handleSubmit?: () => void;
};

export const Modal: React.FC<Props> = ({
  header,
  description,
  handleSubmit,
  children,
}) => {
  return (
    <form
      style={{
        position: "fixed",
        width: "100%",
        height: "100vh",
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        top: 0,
        left: 0,
      }}
      onSubmit={handleSubmit}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: "#131e28",
          color: "#fff",
          padding: "40px",
          borderRadius: "20px",
        }}
      >
        <h1>{header}</h1>
        <p>{description}</p>
        {children}
      </div>
    </form>
  );
};
