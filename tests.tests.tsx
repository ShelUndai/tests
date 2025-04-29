import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { MemoryRouter, NavigateFunction, Location, Params } from 'react-router-dom';
import { ServicesView } from './ServicesPage';
import * as router from 'react-router-dom';
import { act } from 'react-dom/test-utils';

// Mock child components
jest.mock('../../../layouts/EmailDetailsLayout/SearchBox/SearchBox', () => ({
  SearchBox: ({ filterValue, onInputChange }) => (
    <input
      data-testid="search-box"
      value={filterValue}
      onChange={onInputChange}
      placeholder="Filter services..."
    />
  ),
}));

jest.mock('../../../layouts/EmailDetailsLayout/NavBarView/navBarView', () => ({
  NavBarView: () => <div data-testid="nav-bar">NavBar</div>,
}));

jest.mock('../../../layouts/EmailDetailsLayout/ScrollListView/ScrollListView', () => ({
  ScrollListView: ({ items, filterValue, filteredItems, listItemClick, handleAddClick }) => {
    const services = filterValue ? filteredItems.items : items.items;
    return (
      <div data-testid="scroll-list">
        <button onClick={handleAddClick}>Add Service</button>
        {services.map((svc) => (
          <div key={svc.id || svc.svc_id} onClick={() => listItemClick(svc)} data-testid={`service-${svc.id || svc.svc_id}`}>
            {svc.name}
          </div>
        ))}
      </div>
    );
  },
}));

jest.mock('../../../layouts/EmailDetailsLayout/PaginationView/PaginationView', () => ({
  PaginationView: ({ items, filterValue, filteredItems, page, limit, handleNext, handlePrevious, updateLimit }) => {
    const services = filterValue ? filteredItems.items : items.items;
    const totalPages = Math.ceil(services.length / limit);
    return (
      <div data-testid="pagination">
        <span>Page {page}</span>
        <button onClick={handlePrevious} disabled={page === 1}>
          Previous
        </button>
        <button onClick={handleNext} disabled={page === totalPages}>
          Next
        </button>
        <button onClick={() => updateLimit(10, services)}>Set Limit 10</button>
      </div>
    );
  },
}));

jest.mock('../../../layouts/EmailDetailsLayout/ServiceDetails/ServiceDetails', () => ({
  ServiceDetails: ({
    selectedService,
    toggleAccountConformity,
    startCreatingNewService,
    editExistingSvc,
    openAlertDialog,
  }) => (
    <div data-testid="service-details">
      {selectedService ? <div>Selected: {selectedService.name}</div> : <div>No Service Selected</div>}
      <button onClick={toggleAccountConformity}>Toggle Conformity</button>
      <button onClick={startCreatingNewService}>Create Service</button>
      {selectedService && <button onClick={editExistingSvc}>Edit Service</button>}
      {selectedService && (
        <button
          onClick={() => openAlertDialog({ target: { innerText: 'DEACTIVATE' } })}
          data-testid="deactivate-button"
        >
          Deactivate
        </button>
      )}
    </div>
  ),
}));

jest.mock('../../../layouts/EmailDetailsLayout/AlertDialog', () => ({
  AlertDialog: ({ shouldOpen, closeFn, executeFn, description, executeMessage }) =>
    shouldOpen ? (
      <div data-testid="alert-dialog">
        <p>{description}</p>
        <button onClick={closeFn}>Cancel</button>
        <button onClick={executeFn}>{executeMessage}</button>
      </div>
    ) : null,
}));

// Create a mock Redux store
const mockStore = configureStore([]);

// Initialize the mock store with mockInitialProps
const store = mockStore({
  servicesViewReducer: mockInitialProps.services,
  accountsViewReducer: mockInitialProps.accounts,
  linkedAccount: { account: null, groupId: '' },
  unlinkedAccount: { account: null, groupId: '' },
  services: mockInitialProps.services,
  allservices: mockInitialProps.allservices,
});

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => {
  const actualRouter = jest.requireActual('react-router-dom');
  return {
    ...actualRouter,
    useNavigate: jest.fn<NavigateFunction, []>(),
    useLocation: jest.fn<Location, []>(),
    useParams: jest.fn<Readonly<Params<string>>, []>(),
  };
});

// Mock the useStyles hook for withStyles
const mockUseStyles = jest.fn(() => ({
  classes: {
    views: 'mock-views',
    servicesContainer: 'mock-services-container',
    booleanWrapper: 'mock-boolean-wrapper',
    greenAnswer: 'mock-green-answer',
    redAnswer: 'mock-red-answer',
  },
}));
jest.mock('../ServicesPage/styles', () => mockUseStyles);

const mockDispatch = jest.fn();
store.dispatch = mockDispatch;

// Define a more accurate Props interface for ServicesView
interface RouterProps {
  navigate: NavigateFunction;
  location: Location;
  params: Readonly<Params<string>>;
}


interface Props {
  closeErrorModal: (...args: any[]) => any;
  routerProps: RouterProps;
  accountHasUnlinked: boolean;
  accountWasUnlinked: boolean;
  fetchSVCs: (...args: any[]) => any;
  fetchAllSVCs: (...args: any[]) => any;
  fetchServiceToken: (...args: any[]) => any;
  fetchAccounts: (...args: any[]) => any;
  fetchGroups: (...args: any[]) => any;
  fetchPayloads: (...args: any[]) => any;
  addService: (...args: any[]) => any;
  updateService: (...args: any[]) => any;
  deleteService: (...args: any[]) => any;
  removeGroupAccount: (...args: any[]) => any;
  services: { items: Service[]; isFetching: boolean };
  isFetching: boolean;
  allservices: { items: Service[]; isFetching: boolean };
  accounts: { items: Account[]; isFetching: boolean };
  payloads: { items: any[]; isFetching: boolean };
  groups: { items: Group[]; isFetching?: boolean };
  linkedAccounts: { account: any; groupId: string };
  unlinkedAccount: { account: any; groupId: string };
  showError?: boolean;
  classes?: any;
}

describe('ServicesView Component', () => {
  let mockNavigate: NavigateFunction;
  let mockLocation: Location;
  let mockParams: Readonly<Params<string>>;
  let mockProps: Props;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNavigate = jest.fn();
    mockLocation = { pathname: '/services', search: '', hash: '', state: null, key: '' };
    mockParams = { svcId: '' };

    (router.useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (router.useLocation as jest.Mock).mockReturnValue(mockLocation);
    (router.useParams as jest.Mock).mockReturnValue(mockParams);

    mockProps = {
      closeErrorModal: jest.fn(),
      routerProps: {
        navigate: mockNavigate,
        location: mockLocation,
        params: mockParams,
      },
      accountHasUnlinked: mockInitialProps.accountHasUnlinked,
      accountWasUnlinked: mockInitialProps.accountWasUnlinked,
      fetchSVCs: jest.fn(),
      fetchAllSVCs: jest.fn(),
      fetchServiceToken: jest.fn(),
      fetchAccounts: jest.fn(),
      fetchGroups: jest.fn(),
      fetchPayloads: jest.fn(),
      addService: jest.fn(),
      updateService: jest.fn(),
      deleteService: jest.fn(),
      removeGroupAccount: jest.fn(),
      services: mockInitialProps.services,
      isFetching: mockInitialProps.isFetching,
      allservices: mockInitialProps.allservices,
      accounts: mockInitialProps.accounts,
      payloads: mockInitialProps.payloads,
      groups: mockInitialProps.groups,
      linkedAccounts: {
        account: null,
        groupId: '',
      },
      unlinkedAccount: {
        account: null,
        groupId: '',
      },
      showError: false,
    };

    store.clearActions();
  });

  it('renders the component and displays services', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView {...mockProps} />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByTestId('search-box')).toBeInTheDocument();
    expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-list')).toBeInTheDocument();
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    expect(screen.getByTestId('service-details')).toBeInTheDocument();

    expect(screen.getByText('254_44')).toBeInTheDocument();
  });

  it('fetches services and accounts on mount', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView {...mockProps} />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      const actions = store.getActions();
      expect(actions).toContainEqual(
        expect.objectContaining({ type: 'SERVICES/FETCH' })
      );
      expect(actions).toContainEqual(
        expect.objectContaining({ type: 'ACCOUNTS/FETCH' })
      );
    });
  });

  it('filters services based on input', async () => {
    mockProps.services.items = [
      ...mockProps.services.items,
      {
        id: 255,
        name: "255_45",
        account_use: "APP",
        cyberark_id: "653_9",
        last_password_reset: "2024-04-18 15:46:35+08:00",
        last_password_fetch: "2024-04-25 19:26:36+08:00",
        record_creation_date: null,
        user_defined_name: "SB_DB_RND_2",
        address: "SB_DB_RND_2",
        description: "Another RND Credential Database",
        active: true,
        created_by: "PK26957",
        cyberark_managed: false,
        prod_domain: "",
        rtm_number: null,
        last_updated_timestamp: "2024-04-27T08:05:11.679246Z",
      },
    ];
    mockProps.allservices.items = mockProps.services.items;

    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView {...mockProps} />
        </MemoryRouter>
      </Provider>
    );

    const filterInput = screen.getByTestId('search-box');

    await act(async () => {
      fireEvent.change(filterInput, { target: { value: '254_44' } });
    });

    expect(screen.getByText('254_44')).toBeInTheDocument();
    expect(screen.queryByText('255_45')).not.toBeInTheDocument();
  });

  it('selects a service on click', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView {...mockProps} />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('No Service Selected')).toBeInTheDocument();

    const service = screen.getByTestId('service-254');
    await act(async () => {
      fireEvent.click(service);
    });

    expect(screen.getByText('Selected: 254_44')).toBeInTheDocument();
  });

  it('navigates to service details on mount with svcId', () => {
    (router.useParams as jest.Mock).mockReturnValue({ svcId: '254' });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/services/254']}>
          <ServicesView
            {...mockProps}
            routerProps={{
              navigate: mockNavigate,
              location: mockLocation,
              params: { svcId: '254' },
            }}
          />
        </MemoryRouter>
      </Provider>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/services/254');
  });

  it('handles pagination correctly', async () => {

    render(
      <Provider store={paginatedStore}>
        <MemoryRouter>
          <ServicesView
            {...mockProps}
            services={paginatedStore.getState().services}
            allservices={paginatedStore.getState().allservices}
          />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Service_254')).toBeInTheDocument();
    expect(screen.queryByText('Service_284')).not.toBeInTheDocument();

    const nextButton = screen.getByText('Next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    expect(screen.queryByText('Service_254')).not.toBeInTheDocument();
    expect(screen.getByText('Service_284')).toBeInTheDocument();
  });

  it('updates limit correctly', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView {...mockProps} />
        </MemoryRouter>
      </Provider>
    );

    const setLimitButton = screen.getByText('Set Limit 10');
    await act(async () => {
      fireEvent.click(setLimitButton);
    });

    expect(setLimitButton).toBeInTheDocument();
  });

  it('toggles account conformity', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView {...mockProps} />
        </MemoryRouter>
      </Provider>
    );

    const toggleButton = screen.getByText('Toggle Conformity');
    await act(async () => {
      fireEvent.click(toggleButton);
    });

    expect(toggleButton).toBeInTheDocument();
  });

  it('creates a new service', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView {...mockProps} />
        </MemoryRouter>
      </Provider>
    );

    const addButton = screen.getByText('Add Service');
    await act(async () => {
      fireEvent.click(addButton);
    });

    const createButton = screen.getByText('Create Service');
    await act(async () => {
      fireEvent.click(createButton);
    });

    const actions = store.getActions();
    expect(actions).toContainEqual(
      expect.objectContaining({ type: expect.stringContaining('ADD_SERVICE') })
    );
  });

  it('edits an existing service', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView {...mockProps} />
        </MemoryRouter>
      </Provider>
    );

    const service = screen.getByTestId('service-254');
    await act(async () => {
      fireEvent.click(service);
    });

    const editButton = screen.getByText('Edit Service');
    await act(async () => {
      fireEvent.click(editButton);
    });

    const actions = store.getActions();
    expect(actions).toContainEqual(
      expect.objectContaining({ type: expect.stringContaining('UPDATE_SERVICE') })
    );
  });

  it('deletes a service', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView {...mockProps} />
        </MemoryRouter>
      </Provider>
    );

    const service = screen.getByTestId('service-254');
    await act(async () => {
      fireEvent.click(service);
    });

    const deactivateButton = screen.getByTestId('deactivate-button');
    await act(async () => {
      fireEvent.click(deactivateButton);
    });

    const executeButton = screen.getByText('DEACTIVATE SERVICE');
    await act(async () => {
      fireEvent.click(executeButton);
    });

    const actions = store.getActions();
    expect(actions).toContainEqual(
      expect.objectContaining({ type: expect.stringContaining('DELETE_SERVICE') })
    );

    expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
  });
});
