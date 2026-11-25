// Reports who is answering: the server's name, the plugin's version and the server's pid.
export const reportHealth = ({ version, pid }) => () => ({ name: 'alper-brain', version, pid })
