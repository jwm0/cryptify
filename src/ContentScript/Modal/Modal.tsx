import React from "react";

type Props = {
  handleSubmit?: () => void;
};

export const Modal: React.FC<Props> = ({ handleSubmit, children }) => {
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
          backgroundColor: "#160A47",
          padding: "20px 40px",
          borderRadius: "20px",
        }}
      >
        {children}
      </div>
    </form>
  );
};
